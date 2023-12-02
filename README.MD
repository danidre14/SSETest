# Purpose 

SSETest is a Communication Protocol Attempt for the server sending requests to a client via Server-Sent Events, and resolving the responses.

# Reason

I had a process (Process) that was long-running, but not acting like a server, in that it would just process data daily, and not need to worry about handling requests and providing pages. This process is closer to being, for example, a worker dyno on heroku, or background worker on onrender.

Eventually, I wanted a way to monitor the data for this Process, without having to check the command line. Rather than turn the Process into a web-server, I decided to create a separate service (Service) for just displaying the data. The Process would occasionally send data to the Service, which would display it to the user that landed on its page.

Now, from the Service's data screen, I want a way to send commands to the Process, or retrieve certain data by choice, rather than try to only rely on what is outputted to the Service. Of course, I can just let the Service cache the outputted data and store it in different ways for convenient retrieval, but handling the data storage in 2 areas is more time consuming...and I still would have liked to send commands anyways.

**Thus, this library was born.**

The Process can listen in for specific commands and respond to those accordingly, and not have to send all of it's data at high periodic intervals, but only when requested.

## Disclaimers/Acknowledgements

There most certainly are better ways for doing this. The need for this library arose from what could possibly be bad architecture and design. Perhaps there is an ideal way to bundle the Process and Service together on one server.

However, separating them allows me to update the Service as much as I want without having to turn the Process off and on again (restarting/rebuilding when redeploying), and only restart the Process itself when I have made some processing modifications.

Additionally, having them separate allows me to deploy them in different areas; the Process can go in a dedicated VM, and the Service can go to my shared VM.

## Server
On the server-side, the SSERequestRuuter provides a wrapper with syntax similar to a fetch.
> Note, it does not follow all fetch specifications.

## Client
On the client-side, the SSEResponseRuuter provides a wrapper with syntax similar to expressjs routers/middlewares.
> Note, it does not have all the method and functions that express has.

# Test

Navigate to each directory and start their respective javascript files to test it. You can be more interactive via the server, since the test includes code to support that request.

## Server

1) Start the server from the command line:
```sh
$ cd sse-server
$ node server.js
```

2) Navigate to the `calc/a/b/` route for the server via your browser or otherwise. This server endpoint is what _'fetches '_ data from the sse-client.

```
http://localhost:3001/10/5
```

Since the client has not started, the request may time out eventually after 10-30 seconds (set by the ttl option or defaults to 30 seconds). Until the timeout, it is queued.


## Client

1) Start the client from the command line:
```sh
$ cd sse-client
$ node main.js
```

## Now experiment

Requests from the server would query the client when connected, and the response from the client would be returned to the server, and in turn returned to the viewer.

# Final Disclaimer

This is an experiment library, and I cannot vouch for its production-readiness. Please do not hold me liable for any damages or loss that may result in the usage of this. Experiment on your own and use at your comfort and choice.