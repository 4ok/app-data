'use strict';

const mongojs = require('mongojs');
const q       = require('q');
const _       = require('lodash');
const config  = require('config');

const mongo = config.db.mongo;
const db    = mongojs([ // TODO errors
    'mongodb://',
    mongo.host,
    ':',
    mongo.port,
    '/',
    mongo.db
].join(''));

module.exports = class {

    constructor(collectionName) {
        this._collectionName = collectionName;
    }

    find(options) {
        const deferred = q.defer();
        const query = this
            ._getDb()
            .collection(this._getCollectionName())
            .find(options.filter);

        if (options.hasOwnProperty('sort')) {
            query.sort(options.sort); // TODO: order to int (1, -1)
        }

        if (options.hasOwnProperty('limit')) {
            query.limit(options.limit);
        }

        query.toArray(function(error, result) {

            (error)
                ? deferred.reject(new Error(error))
                : deferred.resolve(result);
        });

        return deferred.promise;
    }

    findOne(options) {
        const deferred = q.defer();

        this
            ._getDb()
            .collection(this._getCollectionName())
            .findOne(options.filter, function (error, data) {
                let result = {};

                if (options.hasOwnProperty('fields')) { // @todo to const and this property for list
                    const fields = options['fields'];

                    _.forEach(fields, function (alias, name) {

                        if (true === alias) {
                            alias = name;
                        }

                        result[alias] = data[name];
                    });
                } else {
                    result = data;
                }

                (error)
                    ? deferred.reject(new Error(error))
                    : deferred.resolve(result);
            });

        return deferred.promise;
    }

    aggregate(data) {
        const deferred = q.defer();

        this
            ._getDb()
            .collection(this._getCollectionName())
            .aggregate(data, function (error, result) { // @todo extract to method

                (error)
                    ? deferred.reject(new Error(error))
                    : deferred.resolve(result);
            });

        return deferred.promise;
    }

    save(data) {
        let result;

        if (data.hasOwnProperty('_id')) {
            const filter = {
                _id: data._id
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
        const deferred = q.defer();

        this
            ._getDb()
            .collection(this._getCollectionName()) // @todo refactor
            .update(filter, {
                $set: data
            }, function (error, result) { // @todo extract to method

                (error)
                    ? deferred.reject(new Error(error))
                    : deferred.resolve(result);
            });

        return deferred.promise;
    }

    insert(data) {
        const deferred = q.defer();

        this
            ._getDb()
            .collection(this._getCollectionName())
            .insert(data, function (error, result) { // @todo extract to method

                (error)
                    ? deferred.reject(new Error(error))
                    : deferred.resolve(result);
            });

        return deferred.promise;
    }

    remove(filter) {
        const deferred = q.defer();

        this
            ._getDb()
            .collection(this._getCollectionName())
            .remove(filter, function (error, result) { // @todo extract to method

                (error)
                    ? deferred.reject(new Error(error))
                    : deferred.resolve(result);
            });

        return deferred.promise;
    }

    _getDb() {
        return db;
    }

    _getCollectionName() {
        return this._collectionName;
    }
};
