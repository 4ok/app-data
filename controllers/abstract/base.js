/* eslint-disable no-underscore-dangle */

const groupBy = require('lodash.groupby');

const OPTION_CUSTOM_PROPERTY_PARENT = '#parent';
const OPTION_CUSTOM_PROPERTY_CHAIN = '#chain';

const MODEL_METHOD_FIND_ONE = 'findOne';
const MODEL_METHOD_FIND = 'find';

const COLLECTION_FIELD_PARENT_ID_CATEGORY = 'parent_id';
const COLLECTION_FIELD_PARENT_ID_ELEMENT = 'parent_id'; // @todo

const CHAIN_SEPARATOR = '/';

module.exports = class {

    // TODO
    // static ACTION_ADD = 'add';
    //
    // static ACTION_EDIT = 'edit'
    //
    // static ACTION_DELETE = 'delete';

    constructor(entityAlias) {
        this._entityAlias = entityAlias;
        this._modelName = entityAlias; // @todo
    }

    _getEntityAlias() {
        return this._entityAlias;
    }

    _getModelName() {
        return this._modelName;
    }

    _getModel(name) {
        name = name || this._getModelName();

        // eslint-disable-next-line global-require, import/no-dynamic-require
        const Model = require('../../models/' + name);

        // TODO: cache
        return new Model();
    }

    _find(options, isOne) {
        const parentOptions = this.constructor._getParentOptions(options);
        const method = (isOne)
            ? MODEL_METHOD_FIND_ONE
            : MODEL_METHOD_FIND;

        let result;

        if (parentOptions) {
            result = this
                ._getParent(parentOptions)
                .then((parent) => {
                    this._sendResponse404IfItemIsNull(
                        parent,
                        'Parent item not found',
                        options,
                        this._getModelName()
                    );

                    options = this._getCurrentOptions(options, parent);

                    return this._getCurrent(method, options);
                });
        } else {
            result = this._getCurrent(method, options);
        }

        return result.then((data) => {
            this._sendResponse404IfItemIsNull(
                data,
                'Item(s) not found',
                options
            );

            return data;
        });
    }

    _findOne(options) {
        return this._find(options, true);
    }

    _findTree(options) {
        return this
            ._find(options)
            .then((items) => {
                let result;

                if (items.length) {
                    result = Promise.all(items.map((item) => {
                        // todo: IMPORTANT!
                        const childrenOptions = options;

                        childrenOptions.filter = Object.assign({}, childrenOptions.filter);
                        // todo: why alias?
                        delete childrenOptions.filter.alias;
                        childrenOptions.filter.parent_id = item._id;

                        return this
                            ._findTree(childrenOptions)
                            .then((children) => {

                                if (children.length) {
                                    children = groupBy(children, 'parent_id');
                                    item.children = children[item._id]; // @todo
                                }

                                return item;
                            });
                    }));
                } else {
                    result = items;
                }

                return result;
            });
    }

    _findChain(options) {
        return this._getChain(
            options[0],
            options[1],
            this._getModelName(),
            MODEL_METHOD_FIND_ONE,
            {}
        );
    }

    // @todo for category
    _save(data) {
        return this
            ._getModel(this._getModelName()) // @todo refactor
            .save(data);
    }

    _remove(filter) {
        return this
            ._getModel(this._getModelName())
            .remove(filter);
    }

    _getCurrent(method, options) {
        const extraFields = options.extraFields || [];

        return this
            ._processOptionsCustomPropertiesAndFind(
                this._getModelName(),
                method,
                options
            )
            .then((item) => {
                let result = item;

                if (extraFields.includes('num')) {
                    result = this._getNumberChildren(item);
                }

                return result;
            });
    }

    _getParent(options) {
        return this._processOptionsCustomPropertiesAndFind(
            this._getModelName(),
            MODEL_METHOD_FIND_ONE,
            options
        );
    }

    _processOptionsCustomPropertiesAndFind(modelName, method, options) {
        const filter = options.filter || {};
        let hasChain = false;
        let result;

        Object
            .keys(filter)
            .forEach((key) => {
                const value = filter[key];

                if (value && value[OPTION_CUSTOM_PROPERTY_CHAIN]) {
                    delete filter[key];

                    result = this._getChain(
                        key,
                        value[OPTION_CUSTOM_PROPERTY_CHAIN],
                        modelName,
                        method,
                        options,
                        true
                    );
                    hasChain = true;
                }
            });

        if (!hasChain) {
            result = this._getModelResult(method, options, modelName);
        }

        return result;
    }

    _getChain(field, chain, modelName, method, options, isReturnOnlyLast) {
        chain = (Array.isArray(chain))
            ? Object.assign({}, chain)
            : chain.split(CHAIN_SEPARATOR);

        const parentFieldId = COLLECTION_FIELD_PARENT_ID_CATEGORY;
        const lastIndex = chain.length - 2;
        let firstChainOptions = {
            filter: {
                alias: chain.shift(),
            },
        };

        if (!chain.length) {
            firstChainOptions = Object.assign(options, firstChainOptions);
        }

        const chains = [];
        const find = (methodName, params) =>
            this
                ._getModelResult(methodName, params, modelName)
                .then((result) => {

                    if (!isReturnOnlyLast) {
                        chains.push(result);
                    }

                    return result;
                });

        let result = find(MODEL_METHOD_FIND_ONE, firstChainOptions, modelName);

        chain.forEach((value, index) => {
            result = result
                .then((parent) => {
                    let childOptions;

                    this._sendResponse404IfItemIsNull(
                        parent,
                        'One of parent item not found',
                        options,
                        modelName
                    );

                    if (index === lastIndex) {

                        if (options.filter !== undefined // @todo
                            && options.filter[parentFieldId] !== undefined
                            && options.filter[parentFieldId] !== parent._id
                        ) {
                            this._response.send404([
                                'Not correct filter, parents isn`t equals: ',
                                options.filter[parentFieldId] !== parent._id,
                                '. Filter: ',
                                JSON.stringify(options),
                            ]);
                        }

                        childOptions = Object.assign({}, options);

                        if (!childOptions.filter) {
                            childOptions.filter = {};
                        }
                    } else {
                        childOptions = {
                            filter: {},
                        };
                    }

                    childOptions.filter[field] = value;
                    childOptions.filter[parentFieldId] = parent._id;

                    const currentMethod = (index === lastIndex)
                        ? method
                        : MODEL_METHOD_FIND_ONE;

                    return find(currentMethod, childOptions, modelName);
                });
        });

        return result.then((data) => {
            let res = chains;

            if (isReturnOnlyLast) {
                res = data;
            }

            return res;
        });
    }

    _getNumberChildren(items) {
        const isOne = !Array.isArray(items);

        items = [].concat(items);

        const categoriesId = items.map(item => item._id);
        const aggregate = () => {
            const fieldName = 'parent_id';
            const match = {};

            match[fieldName] = {
                $in: categoriesId,
            };

            return this._getModelResult('aggregate', [
                {
                    $match: match,
                },
                {
                    $group: {
                        _id: {
                            parent_id: '$' + fieldName,
                            is_category: '$is_category', // @todo
                        },
                        num: {
                            $sum: 1,
                        },
                    },
                },
            ]);
        };

        return aggregate()
            .then(result => this.constructor._getItemsWithNumChildren(items, result))
            .then(result => (isOne ? result[0] : result));
    }

    static _getItemsWithNumChildren(items, numChildren) {
        const numChildrenKeyParentId = {};

        Object
            .keys(numChildren)
            .forEach((key) => {
                const value = numChildren[key];
                const group = value._id;
                const entity = (group.is_category)
                    ? 'categories'
                    : 'elements';

                if (!numChildrenKeyParentId[group.parent_id] !== undefined) {
                    numChildrenKeyParentId[group.parent_id] = {};
                }

                numChildrenKeyParentId[group.parent_id][entity] = value.num;
            });

        return items.map((item) => {

            if (!item.num !== undefined) {
                item.num = {
                    categories: 0,
                    elements: 0,
                    children: 0,
                };
            }

            if (numChildrenKeyParentId[item._id] !== undefined) {
                const itemNumChildren = numChildrenKeyParentId[item._id];

                Object
                    .keys(itemNumChildren)
                    .forEach((key) => {
                        const num = itemNumChildren[key];

                        item.num[key] = num;
                        item.num.children += num;
                    });
            }

            return item;
        });
    }

    static _getParentOptions(options) {
        let result;

        if (options.filter !== undefined
            && options.filter[OPTION_CUSTOM_PROPERTY_PARENT] !== undefined
        ) {
            result = {
                filter: options.filter[OPTION_CUSTOM_PROPERTY_PARENT],
            };
        }

        return result;
    }

    _getCurrentOptions(options, parent) {
        const currentOptions = Object.assign({}, options);

        delete currentOptions.filter[OPTION_CUSTOM_PROPERTY_PARENT];

        const parentFieldId = this._getParentFieldId();

        currentOptions.filter[parentFieldId] = parent._id;

        return currentOptions;
    }

    _getParentFieldId() {
        return (this._isCategoryEntity)
            ? COLLECTION_FIELD_PARENT_ID_CATEGORY
            : COLLECTION_FIELD_PARENT_ID_ELEMENT;
    }

    _sendResponse404IfItemIsNull(item, error, options, modelName) {

        if (!item) {

            if (!modelName) {
                modelName = this._getModelName();
            }

            throw new Error([
                error + '.',
                'Model:',
                modelName + '.',
                'Filter:',
                JSON.stringify(options),
            ].join(' '));

            // this._response.send404([
            //    error + '.',
            //    'Model:',
            //    modelName + '.',
            //    'Filter:',
            //    JSON.stringify(options)
            // ].join(' '));
        }
    }

    _getModelResult(methodName, options, modelName) {

        if (!modelName) {
            modelName = this._getModelName();
        }

        return this._getModel(modelName)[methodName](options);
    }
};
