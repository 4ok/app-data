'use strict';

const q = require('q');
const _ = require('lodash');
const BreakPromise = require('break-promise');

const joi = require('joi'); // @todo
const mongojs = require('mongojs'); // @todo

// Entities
const ENTITY_TYPE_CATEGORY = 'category';
const ENTITY_TYPE_ELEMENT = 'element';
// const ENTITY_ALIAS_PAGE = 'page';
// const ENTITY_ALIAS_ARTICLE = 'article';

// Http methods
const HTTP_METHOD_GET = 'get';
const HTTP_METHOD_POST = 'post';

// Actions names
const ACTION_ADD = 'add';
const ACTION_EDIT = 'edit';
// const ACTION_DELETE = 'delete';

const Index = require('./base');

module.exports = class extends Index {

    indexAction(options) {
        return this._findOne(options);
    }

    listAction(options) {
        // const remove = this.removeAction(options);
        const remove = false;
        const find = this._find.bind(this, options);

        return (remove)
            ? remove.then(find)
            : find();
    }

    treeAction(options) {
        return this._findTree(options);
    }

    chainAction(options) {
        return this._findChain(options);
    }

    addAction(options) {
        return this._saveAction(ACTION_ADD, options);
    }

    editAction(options) {
        return this._saveAction(ACTION_EDIT, options);
    }

    // removeAction(options) {
    //     const request = this._request;
    //     var self    = this;
    //     var result;
    //
    //     if (options.allow_remove && query[ACTION_DELETE]) { // TODO allow_remove
    //        var id = query[ACTION_DELETE];
    //        result = this._remove({
    //                _id: mongojs.ObjectId(id) // @todo
    //            })
    //            .then(function () {
    //                var url = request.get('path');
    //
    //                // @todo delete message to module
    //                request.session('message', 'Элемент успешно удален'); // @todo name or id
    //
    //                self
    //                    ._getResponse()
    //                    .redirect(url); // @todo get params
    //
    //                throw new([
    //                    'Redirect',
    //                    {
    //                        url:    url,
    //                        action: 'Delete article "' + id + '"' // @todo
    //                    }
    //                ]);
    //            });
    //     }
    //
    //     return result;
    // }

    _saveAction(action, options) {
        const requestData = this._getRequestData(options);
        const request = this._request;
        let result;

        const getItems = (entityType) => {
            const itemsPath = [
                'app/lib/entities/items',
                this._getEntityAlias(),
                entityType,
                action
            ].join('/');

            return require(itemsPath);
        };

        if (!_.isEmpty(requestData)) { // @todo many rows in method
            let items;

            if (action === ACTION_EDIT) {
                result = this._findOne({
                    filter : {
                        // eslint-disable-next-line new-cap
                        _id : mongojs.ObjectId(requestData._id) // @todo
                    }
                })
                .then(data => {
                    const entityType = (data.is_category)
                        ? ENTITY_TYPE_CATEGORY
                        : ENTITY_TYPE_ELEMENT;

                    items = getItems(entityType);

                    return this._validateAndSave(action, items, requestData);
                });
            } else {
                items = getItems(options.entity_type);
                result = this._validateAndSave(action, items, requestData);
            }

            result = result
                .then((saveResult) => {
                    let res;

                    if (saveResult.error) {
                        let data = requestData;

                        // @todo to const and duplicate code
                        if (options.hasOwnProperty('#assign')) {
                            data = _.assign(options['#assign'], data);
                        }

                        const failData = {
                            alert : {
                                type : 'error',
                                message : saveResult.error
                            },
                            data : data
                        };

                        res = (action === ACTION_ADD)
                            ? failData
                            : this._findOne(options.model)
                            .then((findResult) => {
                                failData.data = _.merge(findResult, failData.data);

                                return failData;
                            });
                    } else {
                        const params = request.get('params'); // @todo
                        let url = ['/cms/content'].concat(
                            this._getEntityAlias()
                        );

                        if (params.parent_alias) {
                            url = url.concat(params.parent_alias);

                            if (action === ACTION_EDIT) {
                                url.pop();
                            }
                        }

                        const saveData = saveResult.data;

                        if (requestData.submit === 'apply') { // @todo apply
                            url = url.concat(saveData.alias, ACTION_EDIT);
                        }

                        url = url.join('/');
                        url += '.html'; // @todo

                        request.session('message', 'Информация успешно сохраненена.');

                        this
                            ._getResponse()
                            .redirect(url);

                        throw new BreakPromise([
                            'Redirect',
                            {
                                url : url,
                                action : 'Save article "' + saveData._id + '"' // @todo
                            }
                        ]);
                    }


                    return res;
                });
        } else {

            const getResult = (params, data) => {

                if (!data) {
                    data = {};
                }

                if (params.hasOwnProperty('#assign')) { // @todo to const
                    data = _.assign(data, params['#assign']);
                }

                const res = {
                    data : data
                };

                if (request.session('message')) {
                    res.alert = {
                        type : 'success',
                        message : request.session('message')
                    };

                    request.clearSession('message'); // @todo session
                }


                return res;
            };

            if (options.model) {
                result = this
                    ._findOne(options.model)
                    .then((findResult) => getResult(options, findResult));
            } else {
                result = getResult(options);
            }
        }

        return result;
    }

    _getRequestData(options) {
        const defaultMethod = HTTP_METHOD_POST;
        const allowMethods = [
            HTTP_METHOD_GET,
            HTTP_METHOD_POST
        ];

        if (!options) {
            options = {};
        }

        const method = (allowMethods.indexOf(options.method) > -1)
            ? options.method
            : defaultMethod;

        let requestKey;

        switch (method) {
            case HTTP_METHOD_POST : {
                requestKey = 'body';
                break;
            }
            case HTTP_METHOD_GET :
            default : {
                requestKey = 'query';
                break;
            }
        }

        return this._request[requestKey](requestKey);
    }

    _validateAndSave(action, items, data) {
        return this
            ._validate(data, items)
            .then((validateResult) => {
                let result;

                if (validateResult.error) {
                    result = validateResult;
                } else {
                    const filteredData = this._filter(validateResult.data, items);
                    let saveData = {};

                    if (action === ACTION_EDIT) {

                        // @todo for db factory
                        _.forEach(items, (item) => {

                            if (item.data) {
                                const itemData = item.data;
                                const value = _.get(filteredData, itemData.path);

                                if (undefined !== value) {
                                    saveData[itemData.path] = value;
                                }
                            }
                        });
                    } else {
                        saveData = filteredData;
                    }

                    delete saveData.submit; // @todo

                    result = this
                        ._save(saveData)
                        .then(() => {
                            return { // TODO
                                data : filteredData
                            };
                        });
                }

                return result;
            });
    }

    _validate(data, items) {
        const schema = this._getValidateSchema(items);
        const options = {
            abortEarly : false,
            presence : 'required',
            language : { // @todo
                any : {
                    empty : 'необходимо указать {{key}}'
                },
                string : {
                    max : 'должно содержать не более {{limit}} символов' // @todo склонения
                },
                object : {
                    base : 'должно быть правильным JSON объектом'
                }
            }
        };
        const deferred = q.defer();

        joi.validate(data, schema, options, (error, validateResult) => { // @todo joi to abstract
            let result = {
                data : validateResult
            };

            if (error) {
                result.error = error;
            }

            deferred.resolve(result);
        });

        return deferred.promise;
    }

    _getValidateSchema(items) {
        let schema = {};

        _.forEach(items, (item) => {

            if (item.data && item.data.input && item.data.input.validator) {
                const data = item.data;

                _.set(schema, data.path, data.input.validator);
            }
        });

        schema.submit = joi.any(); // @todo

        return schema;
    }

    _filter(data, items) {
        const request = this._request;

        _.forEach(items, (item) => {
            const itemData = item.data;
            const filter = _.get(itemData, 'input.filter');

            if (undefined !== filter) {
                const itemValue = _.get(data, itemData.path);
                const filterResult = (_.isFunction(filter))
                    ? filter(itemValue, request)
                    : filter;

                if (undefined !== filterResult) {
                    _.set(data, itemData.path, filterResult);
                }
            }
        });

        return data;
    }
};
