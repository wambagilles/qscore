'use strict';

const
    _ = require('lodash'),
    Promise = require('bluebird'),
    Sequelize = require('sequelize'),
    winston = require('winston');

const
    MaterialModel = require('./material/materiel.model'),
    database = require('../../common/database'),
    {WrongParameterError} = require('../../common/exceptions');



class MaterialError extends Error {
    constructor(message, materialId) {
        super(message);

        this.materialId = materialId;
    }
}



class MaterialNotFoundError extends MaterialError {
    constructor(materialId) {
        super(`Material ${materialId} not found`, materialId);
    }
}



class MaterialValidationError extends Error {
    constructor(message) {
        super(`Material validation error: ${message}`);
    }
}



class MaterialsController {

    constructor() {}


    getAllMaterials(competitionId, viewAll = false) {
        if (!competitionId ||
            competitionId.length <= 0) {
            return Promise.reject(new WrongParameterError('competitionId'));
        }

        winston.debug(
            '[MaterialsController] getAllMaterials(): competitionId=', competitionId,
            ' / viewAll=', viewAll
        );


        const opts = {
            where: {
                competition_id: competitionId,
            },
            order: [
                ['filename'],
            ],
            attributes: ['id', 'filename', 'release_at', 'description'],
        };

        if (!viewAll) {
            _.merge(opts, {
                where: {
                    $or: [
                        {
                            release_at: {
                                $eq: null,
                            },
                        },
                        {
                            release_at: {
                                $lte: Sequelize.fn('NOW'),
                            },
                        },
                    ],
                },
            });
        }

        return MaterialModel.findAll(opts);
    }


    getMaterialById(competitionId, materialId) {
        if (!competitionId ||
            competitionId.length <= 0) {
            return Promise.reject(new WrongParameterError('competitionId'));
        }

        if (!materialId ||
            materialId.length <= 0) {
            return Promise.reject(new WrongParameterError('materialId'));
        }

        winston.debug(
            '[MaterialsController] getMaterialById(): competitionId=', competitionId,
            ' / materialId=', materialId
        );

        const opts = {
            where: {
                competition_id: competitionId,
                id: materialId,
            },
        };

        return MaterialModel
            .find({
                where: {
                    competition_id: competitionId,
                    id: materialId,
                },
                attributes: ['id', 'filename', 'release_at', 'description'],
            })
            .tap((material) => {
                if (!material) {
                    throw new MaterialNotFoundError(materialId);
                }
            })
        ;
    }


    getMaterialDownloadById(competitionId, materialId, viewAll = false) {
        if (!competitionId ||
            competitionId.length <= 0) {
            return Promise.reject(new WrongParameterError('competitionId'));
        }

        if (!materialId ||
            materialId.length <= 0) {
            return Promise.reject(new WrongParameterError('materialId'));
        }

        winston.debug(
            '[MaterialsController] getMaterialDownloadById(): competitionId=', competitionId,
            ' / materialId=', materialId
        );

        const opts = {
            where: {
                competition_id: competitionId,
                id: materialId,
            },
            attributes: ['id', 'filename', 'datafile'],
        };

        if (!viewAll) {
            _.merge(opts, {
                where: {
                    $or: [
                        {
                            release_at: {
                                $eq: null,
                            },
                        },
                        {
                            release_at: {
                                $lte: Sequelize.fn('NOW'),
                            },
                        },
                    ],
                },
            });
        }

        return MaterialModel
            .find(opts)
            .tap((material) => {
                if (!material) {
                    throw new MaterialNotFoundError(materialId);
                }
            })
        ;
    }


    createMaterial(competitionId, filename, file) {
        if (!competitionId ||
            competitionId.length <= 0) {
            return Promise.reject(new WrongParameterError('competitionId'));
        }

        if (!filename ||
            filename.length <= 0) {
            return Promise.reject(new WrongParameterError('filename'));
        }

        if (!file ||
            !_.isObject(file)) {
            return Promise.reject(new WrongParameterError('file'));
        }

        winston.debug(
            '[MaterialsController] createMaterial(): competitionId=', competitionId,
            ' / file.length=', file.length
        );

        return MaterialModel
            .create({
                filename,
                competition_id: competitionId,
                datafile: file.buffer,
            })
            .catch(Sequelize.ValidationError, (err) => {
                throw new MaterialValidationError(err.message);
            })
        ;
    }


    updateMaterial(competitionId, materialId, materialRaw) {
        if (!competitionId ||
            competitionId.length <= 0) {
            return Promise.reject(new WrongParameterError('competitionId'));
        }

        if (!materialId ||
            materialId.length <= 0) {
            return Promise.reject(new WrongParameterError('materialId'));
        }

        if (!materialRaw ||
            !_.isObject(materialRaw)) {
            return Promise.reject(new WrongParameterError('materialRaw'));
        }

        winston.debug('[CompetitionsController] updateMaterial(): competitionId=', competitionId,
            ' / materialId=', materialId);

        return database.transaction((transaction) => MaterialModel
            .find({
                where: {
                    competition_id: competitionId,
                    id: materialId,
                },
                attributes: ['id', 'datafile'],
                transaction,
            })
            .tap((material) => {
                if (!material) {
                    throw new MaterialNotFoundError(materialId);
                }
            })
            .then((material) => {
                const materialUpdate = _.merge(
                    {},
                    material,
                    _.omit(materialRaw, ['id', 'created_at', 'updated_at', 'datafile'])
                );

                if (!materialRaw.release_at) {
                    materialUpdate.release_at = null;
                }

                if (!materialRaw.description) {
                    materialUpdate.description = null;
                }

                return material.update(materialUpdate, {transaction});
            })
            .catch(Sequelize.ValidationError, (err) => {
                throw new MaterialValidationError(err.message);
            })
        );
    }


    removeMaterialById(competitionId, materialId) {
        if (!competitionId ||
            competitionId.length <= 0) {
            return Promise.reject(new WrongParameterError('competitionId'));
        }

        if (!materialId ||
            materialId.length <= 0) {
            return Promise.reject(new WrongParameterError('materialId'));
        }

        winston.debug(
            '[MaterialsController] removeMaterial(): competitionId=', competitionId,
            ' / materialId=', materialId
        );

        return database.transaction((transaction) =>
            MaterialModel
                .find({
                    where: {
                        competition_id: competitionId,
                        id: materialId,
                    },
                    attributes: ['id'],
                    transaction,
                })
                .tap((material) => {
                    if (!material) {
                        throw new MaterialNotFoundError(competitionId);
                    }
                })
                .then((material) => material.destroy({transaction}))
            )
        ;
    }
}



////////////

module.exports = {
    materialsController: new MaterialsController(),
    MaterialError,
    MaterialValidationError,
    MaterialNotFoundError,
};
