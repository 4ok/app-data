'use strict';

const mongojs = require('mongojs');
const q = require('q');
const _ = require('lodash');
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
        const deferred = q.defer();
        const query = this
            ._collection
            .find(options.filter);

        if (options.sort) {
            query.sort(options.sort); // TODO: order to int (1, -1)
        }

        if (options.limit) {
            query.limit(options.limit);
        }

        query.toArray(this._onResult.bind(this, deferred));

        return deferred.promise;
    }

    findOne(options) {
        return this._action('findOne', [options.filter], (deferred, error, data) => {

            if (error) {
                deferred.reject(new Error(error));
            } else {
                let result = {};

                if (options.fields) { // @todo to const and this property for list
                    const fields = options.fields;

                    _.forEach(fields, (alias, name) => {

                        if (alias === true) {
                            alias = name;
                        }

                        result[alias] = data[name];
                    });
                } else {
                    result = data;
                }

                deferred.resolve(result);
            }

        });
    }

    aggregate(data) {
        return this._action('aggregate', [data]);
    }

    save(data) {
        let result;

        if (data.hasOwnProperty('_id')) {
            const filter = {
                _id : data._id,
            };

            data = _.clone(data);
            delete data._id;

            result = this.update(filter, data);
        } else {
            result = this.insert(data);
        }

        return result;
    }

    update(filter, data) {
        return this._action('update', [filter, {
            $set : data,
        }]);
    }

    insert(data) {
        return this._action('insert', [data]);
    }

    remove(filter) {
        return this._action('remove', [filter]);
    }

    _action(name, args, callback) {
        const deferred = q.defer();

        args.push((error, result) => {
            this._onResult(deferred, error, result);

            if (callback) {
                callback(deferred, error, result);
            }
        });

        this._collection[name].apply(this._collection, args);

        return deferred.promise;
    }

    _onResult(deferred, error, result) {

        if (error) {
            deferred.reject(new Error(error));
        } else {
            deferred.resolve(result);
        }
    }

    get _collection() {
        return db.collection(this._collectionName);
    }
};
