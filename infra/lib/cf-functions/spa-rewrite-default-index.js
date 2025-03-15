// https://github.com/aws-samples/amazon-cloudfront-functions/blob/b0493be82f87dc700b3f776f405347bbc3663a2b/url-rewrite-single-page-apps/index.js
async function handler(event) {
    var request = event.request;
    var uri = request.uri;
    
    // Check whether the URI is missing a file name.
    if (uri.endsWith('/')) {
        request.uri += 'index.html';
    } 
    // Check whether the URI is missing a file extension.
    else if (!uri.includes('.')) {
        request.uri += '/index.html';
    }

    return request;
}