var config = require('konfu')
, debug = require('debug')
, express = require('express')
, app = express()
, http = require('http')
, server = http.createServer(app)
, conn = {
    read: require('./db')(config.pg_read_url, config.pg_native),
    write: require('./db')(config.pg_write_url, config.pg_native)
}
, Cache = require('./cache')

console.log('debug filter: DEBUG=%s', process.env.debug)
debug('starting api web server')

app.config = config
debug('config %j', config)

app.use(express.bodyParser())

var routes = ['bitcoincharts', 'v1', 'admin']
routes.forEach(function(name) {
    require('./' + name).configure(app, conn)
})

app.use(function(req, res) {
    res.send(404)
})

if (config.raven) {
    var raven = require('raven')
    app.use(raven.middleware.express(config.raven))
}

var cache = new Cache(conn, function(err) {
    if (err) throw err
    app.cache = cache

    server.listen(config.port)
    debug('listening on %d', config.port)
})