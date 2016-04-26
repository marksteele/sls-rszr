# Edit s-template.json

Edit the values to suit your needs

```
{
    "ResizedCdnCproject": "${stage}-${project}-resized-images.control-alt-del.org",
    "SourceBucket": "${stage}-${project}-s",
    "DestinationBucket": "${stage}-{$project}-r",
    "DestinationStaticUrl" "${stage}-${project}-r.s3-website-${region}.amazonaws.com",
    "ImagesCdnCproject": "${stage}-${project}-images.control-alt-del.org",
    "ResizedCdnCproject": "${stage}-${project}-rimages.control-alt-del.org",
    "ResizerCdnCproject": "${stage}-${project}-reimage.control-alt-del.org",
    "APIGatewayEntryPoint": "PLACEHOLDER.execute-api.${region}.amazonaws.com"
}
```

# Initialize

```
sls project init -n rsz -s dev -r us-east-1 -c true
```

# Deploy lambda and API gateway

```
sls dash deploy
```

Note the API gateway invocation URL. Extract the API identifier:

```
https://fdpz9b88g1.execute-api.us-east-1.amazonaws.com/prod/resize/{size}/{image}
```

In this case, it would be `fdpz9b88g1`.

# Update s-templates.json with API gateway endpoint identifier


```
{
    "ResizedCdnCproject": "${stage}-${project}-resized-images.control-alt-del.org",
    "SourceBucket": "${stage}-${project}-s",
    "DestinationBucket": "${stage}-{$project}-r",
    "DestinationStaticUrl" "${stage}-${project}-r.s3-website-${region}.amazonaws.com",
    "ImagesCdnCproject": "${stage}-${project}-images.control-alt-del.org",
    "ResizedCdnCproject": "${stage}-${project}-rimages.control-alt-del.org",
    "ResizerCdnCproject": "${stage}-${project}-reimage.control-alt-del.org",
    "APIGatewayEntryPoint": "fdpz9b88g1.execute-api.${region}.amazonaws.com"
}
```

# Deploy resources

```
sls resources deploy
```