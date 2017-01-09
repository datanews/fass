/**
 * Main FASS file.
 */
'use strict';

// Read in dot env file if available
require('dotenv').config({ silent: true });

// Dependencies
const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const screenshot = require('desktop-screenshot');
const mkdirp = require('mkdirp');
const moment = require('moment');
const vision = require('node-cloud-vision-api');
const AWS = require('aws-sdk');
const awsConfig = require('aws-config');
const debug = require('debug')('fass');

// Main FASS class
class FASS {
  constructor(options) {
    this.options = _.extend(this.getDefaults(), options);

    // Check options
    if (!this.options.name) {
      this.quit('FASS requires a name to give to the batch.');
    }
    if (this.options.cv && !process.env.FASS_GOOGLE_VISION_KEY) {
      this.quit('FASS requires the FASS_GOOGLE_VISION_KEY enviornment variable when the cv option is enabled.');
    }
    if (this.options.upload && !this.uploadConfig()) {
      this.quit('FASS requires either a uploadProfile options or AWS_ACCESS_KEY_ID and AWS_SECRETE_ACCESS_KEY environment variables.');
    }
    if (this.options.upload && !this.options.bucket) {
      this.quit('FASS requires a bucket parameter if upload is set to true.');
    }

    // Format
    this.options.name = _.kebabCase(this.options.name);

    // Connections
    if (this.options.cv) {
      vision.init({ auth: process.env.FASS_GOOGLE_VISION_KEY });
    }
    if (this.options.upload) {
      AWS.config = this.uploadConfig();
    }

    // Ensure binding
    _.bindAll(this, ['start', 'cv', 'upload']);

    // Start
    if (this.options.autoStart) {
      this.start();
    }
  }

  start() {
    debug('Starting FASS for %s', this.options.name);

    this.makeLocation();
    this.timer = setInterval(_.bind(this.shoot, this), this.options.interval);
    this.shoot();
  }

  shoot() {
    const now = moment();
    const timestamp = now.unix() * 1000 + now.milliseconds();
    const screenshotPath = path.join(this.batchLocation, timestamp + '-fass-' + this.options.name + '.png');

    debug('Saving screenshot to %s', screenshotPath);
    screenshot(screenshotPath, (error, complete) => {
      if (error) {
        debug(error);
        this.quit('Error with creating screenshot.');
      }
      debug('Saved screenshot to %s', screenshotPath);

      if (this.options.cv) {
        this.cv(screenshotPath);
      }
    });
  }

  cv(screenshotPath) {
    const metaPath = screenshotPath.replace('.png', '.json');

    // Setup request
    debug('Making vision request for %s', screenshotPath);
    const request = new vision.Request({
      image: new vision.Image(screenshotPath),
      features: [
        new vision.Feature('TEXT_DETECTION', 100)
      ]
    });

    // Send
    vision.annotate(request).then((response) => {
      debug('Saving meta data locally to %s', metaPath);
      fs.writeFileSync(metaPath, JSON.stringify(response, null, '  '));

      if (this.options.upload) {
        this.upload(screenshotPath, metaPath);
      }
    }).catch((error) => {
      debug(error);
      this.quit('Error while making call to Google Vision API.');
    });
  }

  upload(screenshotPath, metaPath) {
    try {
      // Setup paths
      const screenshotFile = screenshotPath.split('/').pop();
      const metaFile = metaPath.split('/').pop();
      const screenshotKey = [this.options.uploadPrefix, screenshotFile].join('/').replace(/\/\//g, '/');
      const metaKey = [this.options.uploadPrefix, metaFile].join('/').replace(/\/\//g, '/');

      // Setup uploads
      const screenshotParams = {
        Key: screenshotKey,
        ACL: this.options.uploadAccess,
        Body: fs.createReadStream(screenshotPath)
      };
      const metaParams = {
        Key: metaKey,
        ACL: this.options.uploadAccess,
        Body: fs.createReadStream(metaPath)
      };

      // Uploader
      const uploader = new AWS.S3({ params: {
        Bucket: this.options.bucket
      }});

      // Screenshot upload
      debug('Uploading screenshot to S3 at %s', screenshotKey);
      uploader.upload(screenshotParams, (error, result) => {
        if (error) {
          debug(error);
          this.quit('Error uploading file to S3.');
        }

        // Meta data upload
        debug('Uploading meta to S3 at %s', metaKey);
        uploader.upload(metaParams, (error, result) => {
          if (error) {
            debug(error);
            this.quit('Error uploading file to S3.');
          }


          // DONE. TODO something
        });
      });
    }
    catch (e) {
      debug(e);
      this.quit('Error while setting up upload.');
    }
  }

  uploadConfig() {
    if (this.options.uploadProfile) {
      return awsConfig({ profile: this.options.uploadProfile });
    }
    else if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      return awsConfig({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      });
    }
  }

  cancel() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }

  quit(message) {
    console.error(message);
    this.cancel();
    process.exit(1);
  }

  makeLocation() {
    this.batchLocation = path.join(this.options.location, this.options.name);
    mkdirp.sync(this.batchLocation);

    debug('Setting location to %s', this.batchLocation);
  }

  getDefaults() {
    return {
      autoStart: true,
      upload: true,
      uploadPrefix: 'fass',
      uploadAccess: 'private', //private | public-read | public-read-write | authenticated-read
      cv: true,
      interval: 1000 * 60,
      location: path.join(
        process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'],
        '.fass')
    };
  }
}

// Export
module.exports = FASS;
