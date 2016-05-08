'use strict';

const mongojs = require('mongojs');
const config = require('config');

const mongo = config.db.mongo;
const db = mongojs([ // TODO errors
    'mongodb://',
    mongo.host,
    ':',
    mongo.port,
    '/',
    mongo.db,
].join(''));

module.exports = class {

    constructor(collectionName) {
        this._collectionName = collectionName;
    }

    find(options) {
        const query = this._collection.find(options.filter);

        if (options.sort) {
            query.sort(options.sort); // TODO: order to int (1, -1)
        }

        if (options.limit) {
            query.limit(options.limit);
        }

        return new Promise((resolve, reject) => {
            query.toArray(this._onPromiseResult.bind(this, resolve, reject));
        });
    }

    findOne(options) {
        return this
            ._doAction('findOne', [options.filter]) // @todo: sort, etc
            .then(data => {
                let result = {};
                const fields = options.fields;

                if (fields) { // @todo to const and this property for list

                    Object
                        .keys(fields)
                        .forEach(name => {
                            let alias = fields[name];

                            if (alias === true) {
                                alias = name;
                            }

                            result[alias] = data[name];
                        });
                } else {
                    result = data;
                }

                return result;
            });
    }

    aggregate(data) {
        return this._doAction('aggregate', [data]);
    }

    save(data) {
        let result;

        if (data.hasOwnProperty('_id')) {
            const filter = {
                _id : data._id,
            };

            data = Object.assign({}, data);
            delete data._id;

            result = this.update(filter, data);
        } else {
            result = this.insert(data);
        }

        return result;
    }

    update(filter, data) {
        return this._doAction('update', [filter, {
            $set : data,
        }]);
    }

    insert(data) {
        return this._doAction('insert', [data]);
    }

    remove(filter) {
        return this._doAction('remove', [filter]);
    }

    _doAction(name, args) {
        return new Promise((resolve, reject) => {
            args.push(this._onPromiseResult.bind(this, resolve, reject));
            this._collection[name].apply(this._collection, args);
        });
    }

    _onPromiseResult(resolve, reject, error, result) {

        if (error) {
            reject(new Error(error));
        } else {
            resolve(result);
        }
    }

    get _collection() {
        return db.collection(this._collectionName);
    }
};
