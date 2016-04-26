'use strict';
var async = require('async');
var AWS = require('aws-sdk');
var gm = require('gm').subClass({ imageMagick: true });

var s3 = new AWS.S3();

var region = process.env.SERVERLESS_REGION;
var stage = process.env.SERVERLESS_STAGE;
var project = process.env.SERVERLESS_PROJECT;
var destination = process.env.RESIZED_CLOUDFRONT;

var srcBucket = stage + "-" + project + "-sources";
var dstBucket = stage + "-" + project + "-resized";
var dstUrl = "https://" + destination + "/";

exports.handler = function(event, context, callback) {
    var srcKey    = event.image;
    var dstKey    = event.transformation + '/' + srcKey;
    var width,height;

    console.log("srcKey:" + srcKey);
    console.log("dstKey:" + dstKey);

    switch(event.transformation) {
    case "1":
	// 1024x768 ... raw?
	width = 1024;
	height = 768;
	break;
    case "2":
	// 640x480
	width = 640;
	height = 480;
	break;
    case "3":
	// 320x240
	width = 320;
	height = 240;
	break;
    default:
	callback("Could not determine requested image size.");
	return;
    }
    console.log("Width: " + width);
    console.log("Height:" + height);

    // Infer the image type.
    var typeMatch = srcKey.match(/\.([^.]*)$/);
    if (!typeMatch) {
	callback("Could not determine the image type.");
	return;
    }
    var imageType = typeMatch[1];
    if (imageType != "jpg" && imageType != "png") {
	callback('Unsupported image type: ${imageType}');
	return;
    }

    // Download the image from S3, transform, and upload to a different S3 bucket.
    async.waterfall(
	[
	    function download(next) {
		// Download the image from S3 into a buffer.
		s3.getObject(
		    {
			Bucket: srcBucket,
			Key: srcKey
		    },
		    next
		);
	    },
	    function transform(response, next) {
		// Check here to see if object retrieval actually worked...
		// configure source bucket with 404 handler that returns stock not found
		// image?
		gm(response.Body).size(function(err, size) {
		    // Transform the image buffer in memory.
		    this.resize(width, height)
			.toBuffer(imageType, function(err, buffer) {
			    if (err) {
				next(err);
			    } else {
				next(null, response.ContentType, buffer);
			    }
			});
		});
	    },
	    function upload(contentType, data, next) {
		// Stream the transformed image to a different S3 bucket.
		s3.putObject(
		    {
			Bucket: dstBucket,
			Key: dstKey,
			Body: data,
			ContentType: contentType
		    },
		    next
		);
	    }
	], 
	function (err) {
	    if (err) {
		console.error(
		    'Unable to resize ' + srcBucket + '/' + srcKey +
			' and upload to ' + dstBucket + '/' + dstKey +
			' due to an error: ' + err
		);
	    } else {
		console.log(
		    'Successfully resized ' + srcBucket + '/' + srcKey +
			' and uploaded to ' + dstBucket + '/' + dstKey
		);
		context.succeed({
		    location : dstUrl + dstKey
		});
	    }
	    callback(null, "message");
	}
    );
};
