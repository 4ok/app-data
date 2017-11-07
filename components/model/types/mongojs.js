const mongojs = require('mongojs');
// eslint-disable-next-line import/no-unresolved
const config = require('config');

const { mongo } = config.db;
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

        if (options.offset) {
            query.skip(options.offset);
        }

        return new Promise((resolve, reject) => {
            // eslint-disable-next-line no-underscore-dangle
            query.toArray(this.constructor._onPromiseResult.bind(this, resolve, reject));
        });
    }

    findOne(options) {
        const query = this._collection.find(options.filter);

        if (options.sort) {
            query.sort(options.sort);
        }

        query.limit(1);

        return new Promise((resolve, reject) => {
            // eslint-disable-next-line no-underscore-dangle
            query.toArray(this.constructor._onPromiseResult.bind(this, resolve, reject));
        }).then(result => result[0]);
    }

    aggregate(data) {
        return this._doAction('aggregate', [data]);
    }

    save(data) {
        let result;

        // eslint-disable-next-line no-underscore-dangle
        if (data._id !== undefined) {
            const filter = {
                // eslint-disable-next-line no-underscore-dangle
                _id: data._id,
            };

            data = Object.assign({}, data);
            // eslint-disable-next-line no-underscore-dangle
            delete data._id;

            result = this.update(filter, data);
        } else {
            result = this.insert(data);
        }

        return result;
    }

    update(filter, data) {
        return this._doAction('update', [filter, {
            $set: data,
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
            // eslint-disable-next-line no-underscore-dangle
            args.push(this.constructor._onPromiseResult.bind(this, resolve, reject));
            this._collection[name](...args);
        });
    }

    static _onPromiseResult(resolve, reject, error, result) {

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
