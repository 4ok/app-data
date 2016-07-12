module.exports = class {

    callMethod(params, args) {
        params = params.split('/');
        const controller = params[0];
        const action = params[1] || 'index';

        return this._callController(controller, action, args);
    }

    _callController(controllerName, actionName, args) {
        const controllersPath = './controllers/' + controllerName;
        // eslint-disable-next-line global-require
        const Controller = require(controllersPath);
        const controller = new Controller();

        return controller[actionName + 'Action'](args);
    }
};
