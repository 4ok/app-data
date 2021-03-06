const Entity = require('./abstract/entity');

const MENU_ITEM_CHILDREN_PROPERTY = 'children';

module.exports = class extends Entity {

    constructor() {
        super('menu');
    }

    treeAction(options) {
        const equals = {};
        const childProp = MENU_ITEM_CHILDREN_PROPERTY;
        let controllerName;
        let menu;

        return this
            ._findOne(options)
            .then((root) => {
                menu = root;

                const promises = root.items
                    .filter(item => item[childProp])
                    .reduce((result, item, index) => {

                        if (item[childProp]) {
                            const childParams = item[childProp];
                            const method = childParams.method.split('/');

                            [controllerName] = method;
                            const actionName = (method[1] || 'index') + 'Action';
                            const controllersPath = './' + controllerName;
                            // eslint-disable-next-line global-require, import/no-dynamic-require
                            const Controller = require(controllersPath);
                            const controller = new Controller(this._http);

                            equals[index] = item.alias;
                            result.push(controller[actionName](childParams.params));
                        }

                        return result;
                    }, []);

                return Promise.all(promises);
            })
            .then((children) => {
                const childrenHash = children.reduce((result, items, index) => {
                    result[equals[index]] = items;

                    return result;
                }, {});

                const { items } = menu;

                items.map((item) => {

                    if (item[childProp]) {

                        if (!childrenHash[item.alias]) {
                            throw new Error('Menu children "' + item.alias + '" not found');
                        }

                        item[childProp] = childrenHash[item.alias];
                    }

                    return item;
                });

                menu.items = this._getMenuItems(items, controllerName);

                return menu;
            });
    }

    _getMenuItems(items, controllerName, path) {
        const childProp = MENU_ITEM_CHILDREN_PROPERTY;

        return items.map((item) => {
            const result = {
                name: item.name,
                type: controllerName,
                path: (path)
                    ? path + '/' + item.alias
                    : item.alias,
            };

            if (item.route) {
                result.route = item.route;
            }

            if (item[childProp]) {
                result[childProp] = this._getMenuItems(
                    item[childProp],
                    controllerName,
                    result.path
                );
            }

            return result;
        });
    }
};
