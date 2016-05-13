"use strict";
const Promise = require("bluebird");

module.exports = {
  findAll() {
    return Promise.resolve([
      {
        name: "My Cool API",
        slug: "coolapi",
        desc: "Doing coolness since a while ago.",
        createdBy: "1",
        icon: "http://placehold.it/300x300",
        versions: {
          v1: {
            routes: [
              {
                accept: {
                  method: "GET",
                  url: "/devices",
                },
                proxy: [
                // {
                //   method: "GET",
                //   url: "http://scooterlabs.com/echo?get=devices",
                // }
                {
                  via: "websockets",
                  url: "ws://echo.websocket.org",
                  send: [
                    `{"type": "UPDATE", "content": "{{query.value}}"}`,
                  ],
                }
                ],
              },
              {
                accept: {
                  method: "GET",
                  url: "/devices/:id",
                },
                proxy: [{
                  via: "http",
                  method: "POST",
                  url: "http://scooterlabs.com/echo?q={{params.id}}",
                  headers: "Test: {{params.id}}",
                  body: "abc",
                }],
              },
            ],
          },
        },
      },
    ]);
  },
};
