"use strict";
import Api from "./apis";
import handleHttpQuery from "./handlers/http";
import handleWebsocketsQuery from "./handlers/websockets";
import handleStaticQuery from "./handlers/static";
import VisibleError from "./visibleError";

import pathToRegexp from "path-to-regexp";
import _ from "lodash";

function stripInitialSlash(data) {
  if (data[0] === '/') {
    return data.slice(1);
  } else {
    return data;
  }
}

// format a url inside of a query as a full url
function asFullUrl(version, path) {
  return `/api/${version}/${stripInitialSlash(path)}`;
}

function showErrors(res, err) {
  if (err instanceof Error && VisibleError.prototype.visible.call(err)) {
    res.status(err.code || 500).json(VisibleError.prototype.toJSON.call(err));
  } else {
    throw err;
  }
}

// find matching version and route when given req, res, and the selected api
export function getMatchingVersionAndRoute(req, res, api) {
  let version;
  if (version = api.versions[req.params.version]) {
    // get the route that the user is referencing
    let keys = [], re, baseUrl;
    let route = version.routes.find(i => {
      // remove all the query variables and other stuff like that
      baseUrl = req._parsedOriginalUrl.pathname;
      // parse the path to look for param variables
      let fullUrl = asFullUrl(req.params.version, i.accept.url);
      re = pathToRegexp(fullUrl, keys);
      return i.accept.method === req.method && re.exec(baseUrl);
    });

    if (route && route.proxy) {
      // get url params, and remove the first match (of the whole thing)
      let unpairedParams = re.exec(baseUrl).slice(1);
      let params = _.zipObject(
        keys.map(i => i.name),
        unpairedParams
      );

      return {
        baseUrl,
        params,
        route,
      };
    } else {
      throw new VisibleError(404, "No such route, or route cannot handle the request");
    }
  } else {
    throw new VisibleError(400, "The api version specified isn't valid.");
  }
}

// Make sure the returned api is valid
export function findMatchingApi(slug, apis) {
  let api = apis.find(api => api.slug === slug);
  if (api) {
    return api;
  } else {
    throw new VisibleError(400, `No such api with slug '${slug}'`);
  }
}

// ----------------------------------------------------------------------------
// The full api request handler!!!
// ------------------------------------------------------------------------------
export function handleApiRequest(req, res) {
  // get the api we specified
  Api.findAll()
  .then(findMatchingApi.bind(this, req.query.slug))

  // get the route that matches the given request
  .then(getMatchingVersionAndRoute.bind(this, req, res))
  .then(({route, baseUrl, params}) => {
    let stashRoot = Object.assign({}, req, {params});

    // send the data to the client's system
    switch (route.proxy.via) {
      case 'http':
        return handleHttpQuery(req, res, stashRoot, route.proxy);
      case 'websockets':
        return handleWebsocketsQuery(req, res, stashRoot, route.proxy);
      case 'static':
        return handleStaticQuery(req, res, stashRoot, route.proxy);
      default:
        throw new VisibleError(500, `No such handler for request: ${route.proxy[0].via}`);
    }
  })

  // handle errors
  .catch(showErrors.bind(this, res));
}

// return the information for an api
export function getApiInformation(req, res) {
  Api.findAll()
  .then(findMatchingApi.bind(this, req.query.slug))
  .then(({name, slug, desc, versions}) => {
    res.json({
      name, slug, desc,
      versions: Object.keys(versions),
    });
  })
  .catch(showErrors.bind(this, res));
}

export function createApi(req, res) {
  if (req.body.options && req.body.data) {
    return Api.create(req.body.data)
    .then(api => {
      res.send({
        status: 200,
        api,
        routes: {
          root: `http://${api.slug}.example.com/api/`,
          meta: `http://${api.slug}.example.com/api/_meta.json`,
        },
      });
    })
    .catch(showErrors.bind(this, res));
  } else {
    res.status(400)
       .send({error: "Invalid request format. Please include a data and options key."});
  }
}
