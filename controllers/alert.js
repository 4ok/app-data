'use strict';

const Index = require('./abstract/base');

module.exports = class extends Index {

    indexAction() { // TODO
        const request = this._getRequest();
        let result;

        if (request.session('message')) {
            result = {
                type:    'success', // @todo
                message: request.session('message')
            };

            request.clearSession('message')
        }

        return result;
    }
};
