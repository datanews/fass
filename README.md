# FASS (Fully-automatic screenshots)

Periodically take screenshots, pass to Google Vision, upload to S3.

## Install

* For command line: `npm install fass -g`
* For use in application: `npm install fass --save`

## Usage

```
  Usage: fass [options]

  Periodically take screenshots, pass to Google Vision, and upload to S3.
  Ensure that the FASS_GOOGLE_VISION_KEY environment variable is set if using computer vision.

  Options:

    -h, --help               output usage information
    -V, --version            output the version number
    -n, --name <name>        Name for batch. Required.
    -b, --bucket [bucket]    Bucket for S3 upload. Required for uploading.
    -p, --profile [profile]  AWS profile name. Or use environment variables AWS_ACCESS_KEY_ID and AWS_SECRETE_ACCESS_KEY.
    -r, --prefix [prefix]    Prefix for path to file uploaded. Default to "fass".
    -a, --access [type]      S3 access type. Defaults to private.  Can be private, public-read, public-read-write, authenticated-read.
    -i, --interval [n]       Interval in milliseconds. Defaults to 60000.
    -l, --location [path]    Path to store files locally. Defaults to ~/.fass
    -u, --upload             Upload to S3.  Default.
    -U, --no-upload          Don't upload to S3.
    -c, --cv                 Pass to Google Vision. Default.
    -C, --no-cv              Don't pass to Google Vision.
```

Environment variables, needed by default, but can be optional:

* `FASS_GOOGLE_VISION_KEY`: Needed for image analysis.
* `AWS_ACCESS_KEY_ID`: Needed for uploading if profile not given.
* `AWS_SECRETE_ACCESS_KEY`: Needed for uploading if profile not given.

### Library

The library has similar options as the command line and can be used like:

```js
const FASS = require('fass');
const f = new FASS({
  name: 'taking-screenshots-is-fun',
  uploadBucket: 'some-bucket-name',
  uploadProfile: 'default'

  // upload: boolean
  // cv: boolean
  // uploadPrefix: path
  // uploadAccess: access type
  // interval: milliseconds
  // location: local save location
});
```
