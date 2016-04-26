# Introduction

This is a quick Serverless project template for deploying an on-the-fly image resizer leveraging the following pieces of the AWS stack:

* API Gateway
* Lambda
* S3 (with static website hosting, geo restrictions)
* ACM for creating SSL certificates
* Cloudfront CDN distribution points
* CloudFormation to orchestrate everything.

Note: I've tested this in us-east-1. YMMV in other regions.

## API

```
GET /<transformation>/<image name>

Ex: /1/1.jpg
```

Supported transformations

* 1: 1024x768
* 2: 640x480
* 3: 320x240


## Theory of operation

The idea behind this microservice is simple. Given a bucket (the source bucket) of images, we want to provide a set of transformations that produce resized images.

To accomplish this, we'll provision three separate CloudFront CDN distribution points:

* DistributionA: Origin pointing to an S3 bucket configured with static website hosting and a 404 redirection rule pointing to DistributionB via a 307 HTTP redirection
* DistributionB: Origin pointing to API gateway, which will invoke a Lambda function to create the requested image then return a 307 HTTP redirection to DistributionC
* DistributionC: Origin pointing the same origin S3 bucket as DistributionA

Why three distributions?

* The first time an image is requested, DistributionA will return an HTTP 307 (caching the response for about an hour) redirecting to DistributionB.
* The first time DistributionB receives a request, it'll forward the request to API Gateway+Lambda and cache the returned 307 response redirecting to DistributionC.
* By the time the request reaches DistributionC, the image has been created by the Lambda function and is available in S3 so it'll return the image and cache it.
* Subsequent requests to DistributionA will serve cached redirects (as will DistributionB), saving calls to API Gateway eventually redirecting to DistributionC.
* DistributionC will always serve out of cache
* Once the cached responses expire on DistributionA, images will be served directly without any redirects.

Why not have API Gateway/Lambda return the created image? We can't. This makes me sad. API Gateway can only return text responses. I've tried every trick I could come up with to fool it, yet it returns some encoded version of the binary content and it just doesn't work. If at some point in the future API Gateway support binary responses, this could be simplified a bit by removing one of the CDN endpoints.

## Features

* No fixed costs to operate the service. Costs scale with usage.
* Minimized hits to API Gateway/Lambda by using CloudFront caching
* Automatic scaling
* Completely automated provisioning

## WARNING

Use at your own risk. Also, this is something of a prototype and thus functionality is limited. There is no error handling of any kind, and my JS coding skills are definitely sub-par.

Apply due diligence when deploying and modify to taste.

# Preparation

Because I like to always deploy things using SSL, we need to do a bit of up-front legwork.

CloudFormation does not yet support managing ACM SSL certificates for both requesting them as well as associating them with a CloudFront distribution point, we'll be borrowing a Lambda function that does just that, and will use it in CustomTypes with CloudFormation.

## Grab the Lambda

```
git clone https://github.com/ryansb/acm-certs-cloudformation
make acm-functions.zip
```

## Create an S3 bucket

Login to the AWS console, and create an S3 bucket named `lambda-utility`. Drop the zip file into that bucket.

Edit the bucket properties, and add the following bucket policy:

```
{
  "Version": "2012-10-17",
  "Id": "ResizedS3BucketPolicy",
  "Statement": [
    {
      "Sid": "ReadWriteAccess",
      "Effect": "Allow",
      "Principal": { "AWS": "*" },
      "Action": ["s3:GetObject","s3:PutObject"],
       "Resource": "arn:aws:s3:::lambda-utility/*"
    }
   ]
}
```


# Edit s-template.json

Edit the values to suit your needs. Don't touch the `PLACEHOLDER` value yet, we'll fix that later on.

```
{
    "SourceBucket": "${stage}-${project}-s",
    "DestinationBucket": "${stage}-{$project}-r",
    "DestinationStaticUrl" "${stage}-${project}-r.s3-website-${region}.amazonaws.com",
    "ImagesCdnCname": "${stage}-${project}-images.control-alt-del.org",
    "ResizedCdnCname": "${stage}-${project}-rimages.control-alt-del.org",
    "ResizerCdnCname": "${stage}-${project}-reimage.control-alt-del.org",
    "APIGatewayEntryPoint": "PLACEHOLDER.execute-api.${region}.amazonaws.com"
}
```

Adding the stage/project variables to the various endpoint is probably a good idea as it'll allow you to have multiple simultaneous deployments (eg: 1 environment per developer for example).


# Initialize

```
sls project init -n rsz -s dev -r us-east-1
```

# Deploy lambda and API gateway

```
sls dash deploy
```

Note the API gateway invocation URL. Extract the API identifier:

```
https://zzzz9b88g1.execute-api.us-east-1.amazonaws.com/prod/resize/{size}/{image}
```

In this case, it would be `zzzz9b88g1`.

# Update s-templates.json with API gateway endpoint identifier


```
{
    "SourceBucket": "${stage}-${project}-s",
    "DestinationBucket": "${stage}-{$project}-r",
    "DestinationStaticUrl" "${stage}-${project}-r.s3-website-${region}.amazonaws.com",
    "ImagesCdnCname": "${stage}-${project}-images.control-alt-del.org",
    "ResizedCdnCname": "${stage}-${project}-rimages.control-alt-del.org",
    "ResizerCdnCname": "${stage}-${project}-reimage.control-alt-del.org",
    "APIGatewayEntryPoint": "zzzz9b88g1.execute-api.${region}.amazonaws.com"
}
```

# Deploy resources again

At this point we need to re-deploy the resources to tie everything together.

This is due to a chicken and egg problem. We want the to define a CloudFront endpoint that points to API Gateway, but we can't deploy the API Gateway until the resource declaration happens, which defines IAM roles used by Lambda. Yuck! Double Yuck, as Cloudfront takes FOREVER to finish (10-20 minutes or so). Thankfully, this only happens during the initial deploy for the first stage (although creating more stages will create more Cloudfront distributions, which will take time...).

Note: You'll need to wait for the initial CloudFront distributions to complete before re-deploying, as it'll error out otherwise. Also note, the serverless console will return success before the CloudFront resources have finished being deployed.


```
sls resources deploy
```

# Create CNAMEs to your CloudFront endpoints

Grab the list of CloudFront domain names, and add the CNAMEs in your DNS to have friendlier URLs.