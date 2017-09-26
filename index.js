"use strict";
const crypto = require("crypto");
var rfc = require(`./build/${process.platform}_${process.arch}/rfc`);

class Client {
  constructor(props) {
    this.id = crypto.randomBytes(5).toString("hex");
    this.props = props;
    this.client = new rfc.Client(props);
    this.queue = [];
    this.running = false;
  }

  connect() {
    return this.client.connect.apply(this.client, arguments);
  }

  close() {
    return this.client.close.apply(this.client, arguments);
  }

  reopen() {
    return this.client.reopen.apply(this.client, arguments);
  }

  isAlive() {
    return this.client.isAlive.apply(this.client, arguments);
  }

  invoke(method, params, cb) {
    this.queue.push({ method: method, params: params, cb: cb });
    if (!this.running) {
      this._invokeNext();
    }
  }

  _invokeNext() {
    let data = this.queue.shift();
    if (!data) {
      this.running = false;
      return;
    }
    this.running = true;
    this.client.invoke(data.method, data.params, (err, res) => {
      process.nextTick(() => data.cb(err, res));
      this._invokeNext();
    });
  }

  getVersion() {
    return this.client.getVersion.apply(this.client, arguments);
  }

  connectionInfo() {
    return this.client.connectionInfo.apply(this.client, arguments);
  }

  ping() {
    return this.client.ping.apply(this.client, arguments);
  }
};
module.exports.Client = Client;
module.exports.ClientPool = class ClientPool {
  constructor(props, size) {
    this.props = props;
    this.size = size || 4;
    this.clients = [];
    this._nextClient = 0;
  }

  connect(cb) {
    if (this.size < 1) {
      cb && cb(`pool size must be more than 1`);
      return;
    }
    for (let i = 0; i < this.size; ++i) {
      let client = new Client(this.props);
      client.connect((err) => {
        if (err) {
          cb && cb(err);
          cb = undefined;
        }
        this.clients.push(client);
        if (this.clients.length === this.size) {
          cb && cb(null);
        }
      });
    }
  }

  close() {
    this.clients.forEach((client) => {
      client.close();
    });
    this.clients = [];
  }

  client() {
    let client = this.clients[this._nextClient];
    this._nextClient = (this._nextClient + 1) % this.size;
    return client;
  }
}
