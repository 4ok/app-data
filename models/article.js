'use strict';

const Db = require('db');

module.exports = class extends Db {

    constructor() {
        super('article');
    }
};
