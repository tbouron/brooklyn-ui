/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import template from "./inspect.template.html";
import addChildModalTemplate from "./add-child-modal.template.html";
import confirmModalTemplate from "./confirm.modal.template.html";

export const inspectState = {
    abstract: true,
    name: 'main.inspect',
    url: 'application/:applicationId/entity/:entityId',
    template: template,
    controller: ['$scope', '$stateParams', '$uibModal', 'brSnackbar', 'entityApi', inspectController],
    controllerAs: 'vm'
};

export function inspectController($scope, $stateParams, $uibModal, brSnackbar, entityApi) {
    const {
        applicationId,
        entityId
    } = $stateParams;

    let vm = this;
    vm.entityNotFound = false;

    let observers = [];
    entityApi.entity(applicationId, entityId).then((response)=> {
        vm.entity = response.data;
        observers.push(response.subscribe((response)=> {
            vm.entity = response.data;
        }, (response)=> {
            vm.entityNotFound = true;
        }));
    }).catch((error)=> {
        vm.entityNotFound = true;
    });

    $scope.$on('$destroy', ()=> {
        observers.forEach((observer)=> {
            observer.unsubscribe();
        });
    });

    this.addChildToEntity = function() {
        $uibModal.open({
            animation: true,
            template: addChildModalTemplate,
            controller: ['$scope', '$http', '$uibModalInstance', 'applicationId', 'entityId', addChildController],
            size: 'lg',
            resolve: {
                applicationId: ()=>(applicationId),
                entityId: ()=>(entityId),
            }
        }).result.then((closeData)=> {
            $state.go('main.inspect.activites', {
                applicationId: applicationId,
                entityId: closeData.entityId,
                activityId: closeData.id
            });
        })
    };

    this.resetEntityProblems = function() {
        entityApi.resetEntityProblems(applicationId, entityId).catch((error)=> {
            brSnackbar.create('Cannot reset entity problems: the entity [' + entityId + '] or sensor [service.notUp.indicators] is undefined');
        });
        return false;
    };

    this.expungeEntity = function(release = true) {
        let modalScope = $scope.$new(true);
        modalScope.release = release;

        $uibModal.open({
            template: confirmModalTemplate,
            scope: modalScope
        }).result.then((result)=> {
            entityApi.expungeEntity(applicationId, entityId, release).then((response)=> {
                brSnackbar.create('Entity [' + entityId + '] will be ' + (release ? 'expunged' : 'unmanaged') + ' shortly');
            }).catch((error)=> {
                brSnackbar.create('Cannot expunge entity problems: the entity [' + entityId + '] is undefined');
            });
        });
    };
}

export function addChildController($scope, $http, $uibModalInstance, applicationId, entityId) {
    $scope.childEntityYaml = 'services:\n  - type: ';
    $scope.errorMessage = null;
    $scope.deploying = false;
    $scope.addChild = addChild;

    function addChild() {
        $scope.deploying = true;
        $scope.errorMessage = null;
        $http.post('/v1/applications/' + applicationId + '/entities/' + entityId + '/children?start=true&timeout=20ms', $scope.childEntityYaml)
            .then((response)=> {
                $scope.deploying = false;
                $uibModalInstance.close(response.data);
            }, (error)=> {
                $scope.deploying = false;
                if (error.data.hasOwnProperty('message')) {
                    $scope.errorMessage = error.data.message;
                } else {
                    $scope.errorMessage = 'Could not add child ... unknown error';
                }
            });
    }
}
