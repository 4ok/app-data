const CONTROLLERS_PATH = './controllers/';

module.exports = class {

    callMethod(resourceParams, actionParams) {
        this._controllers = {};

        const controllerName = resourceParams.controller || 'index';
        const actionName = resourceParams.action || 'index';
        const controller = this._getController(controllerName);

        return controller[actionName + 'Action'](actionParams);
    }

    _getController(name) {

        if (!this._controllers[name]) {
            const controllerPath = CONTROLLERS_PATH + '/' + name;
            // eslint-disable-next-line global-require
            const Controller = require(controllerPath);

            this._controllers[name] = new Controller();
        }

        return this._controllers[name];
    }
};
