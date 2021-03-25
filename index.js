async function setupPlugin({ config, global }) {
    // Validation of input e.g. URL is available
    console.log("Setting up the plugin!")
    console.log(config)

    global.posthogHost = config.posthogHost.includes('http') ? config.posthogHost : 'https://' + config.posthogHost

    global.posthogOptions = {
        headers: {
            Authorization: `Bearer ${config.posthogApiKey}`
        },
        redirect: 'follow',
    }

    global.rssFeedUrl = config.rssFeedUrl

    global.setupDone = true
}

async function runEveryMinute({ config, global, storage }) {
    // storage.set, storage.get
    console.log('RSS plugin running >>>>>>>>>>>>>>>>>>>>>>>>>')
    console.log('storage', storage)

    const rssUrl = `https://api.rss2json.com/v1/api.json?rss_url=${global.rssFeedUrl}`
    const response = await fetch(rssUrl)
    const json = await response.json()
    // console.log(json)

    for(let item of json.items) {
        const itemExists = (await storage.get(item.guid))
        console.log(`item exists for ${item.guid}?`, itemExists)
        if(!itemExists) {
            console.log(`Creating annotation for ${item.guid}`)
            
            // set annotation
            const httpStatusResult = await createAnnotation(global.posthogHost, config, item)
            console.log(`Annotation creation HTTP status: ${httpStatusResult}`)

            if(httpStatusResult === 201) {
                // posthog.capture is also available in plugins by default
                posthog.capture('rss_item_annotated', { 
                    title: item.title,
                    guid: item.guid,
                })

                // add to storage
                await storage.set(item.guid, 1)
            }
        }
    }

}

async function createAnnotation(posthogHost, config, item) {
    const createAnnotationRes = await fetchWithRetry(
        `${posthogHost}/api/annotation/`,
        {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.posthogApiKey}`,
            },
            body: JSON.stringify({
                content: `${item.title} RSS item published`,
                scope: 'organization',
                date_marker: new Date(item.pubDate).toISOString(),
            }),
        },
        'POST',
    )

    return createAnnotationRes.status
}

async function fetchWithRetry(url, options = {}, method = 'GET', isRetry = false) {
    try {
        console.log('fetchWithRetry', url, method, options)
        const res = await fetch(url, { method: method, ...options })
        return res
    } catch(ex) {
        console.log('fetchWithRetry ex', ex)

        // if (isRetry) {
        //     throw new Error(`${method} request to ${url} failed.`)
        // }
        // const res = await fetchWithRetry(url, options, (method = method), (isRetry = true))
        // return res
        return { status: 500 }
    }
}

module.exports = {
    setupPlugin,
    runEveryMinute,
}
