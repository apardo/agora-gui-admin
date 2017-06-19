/**
 * This file is part of agora-gui-admin.
 * Copyright (C) 2017  Agora Voting SL <agora@agoravoting.com>

 * agora-gui-admin is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License.

 * agora-gui-admin  is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.

 * You should have received a copy of the GNU Affero General Public License
 * along with agora-gui-admin.  If not, see <http://www.gnu.org/licenses/>.
**/

angular.module('avAdmin')
  .controller('CsvLoadingModal',
    function($scope, $modalInstance, $q, ConfigService, Plugins, Authmethod, election, textarea, errorFunc) {
      $scope.election = election;
      $scope.textarea = textarea;
      $scope.helpurl = ConfigService.helpUrl;
      $scope.batchSize = ConfigService.censusImportBatch;
      $scope.error = errorFunc;
      // 0 to 100% (when finished)
      $scope.percent = 0;
      $scope.disableOk = false;

      $scope.cancel = function () {
        $modalInstance.dismiss('cancel');
      };

      function calculateExportList(textarea) {
          var el = $scope.election;
          var cs;
          if (!el.id) {
            cs = el.census.voters;
          } else {
            cs = [];
          }

          var fields = el.census.extra_fields;

          var lines = textarea.split("\n");
          lines.forEach(function(l) {
              var lf = l.split(";");
              var nv = {};
              fields.forEach(function(f, i) { nv[f.name] = lf[i].trim(); });
              if (nv.tlf) {
                nv.tlf = nv.tlf.replace(" ", "");
              }
              if (nv.email) {
                nv.email = nv.email.replace(" ", "");
              }
              cs.push({selected: false, vote: false, username: "", metadata: nv});
          });

          if (!!el.id) {
            var csExport = _.map(cs, function (i) { return i.metadata; });
            return csExport;
          }
          return [];
      }
      $scope.exportList = calculateExportList(textarea);
      $scope.exportListIndex = 0;

      var pluginData = {
        html: [],
        scope: {},
        processBatchPlugin: false,
        startClickedPlugin: false,
        election: $scope.election,
        exportList: $scope.exportList
      };
      Plugins.hook('census-csv-loading-modal', pluginData);
      $scope.exhtml = pluginData.html;
      $scope = _.extend($scope, pluginData.scope);
      $scope.startClickedPlugin = pluginData.startClickedPlugin;

      function calcPercent (index) {
        return index*100.0/$scope.exportList.length;
      }

      function censusCall(id, csExport, opt) {
        var deferred = $q.defer();
        try {
          // this hook can avoid the addCensus call
          if (Plugins.hook('add-to-census-pre', csExport)) {
            Authmethod.addCensus(id, csExport, opt)
              .success(function(r) {
                Plugins.hook('add-to-census-success', {data: csExport, response: r});
                deferred.resolve();
              })
              .error(function(error) {
                $scope.error(error.error);
                Plugins.hook('add-to-census-error', {data: csExport, response: error});
                deferred.reject();
              });
          }
        } catch (error) {
          deferred.reject(error);
        }
        return deferred.promise;
      }

      function processBatch() {
        var deferred = $q.defer();
        try {
          var ret = {
            'percent': $scope.percent,
            'exportListIndex': $scope.exportListIndex,
            'calcPercent': calcPercent
          };
          if ($scope.exportList.length > $scope.exportListIndex) {
            var batch = [];
            if (0 === $scope.batchSize ||
                ($scope.exportList.length - $scope.exportListIndex) <= $scope.batchSize) {
               batch = $scope.exportList.slice($scope.exportListIndex);
            } else {
               batch = $scope.exportList.slice($scope.exportListIndex, $scope.exportListIndex + $scope.batchSize);
            }
            censusCall($scope.election.id, batch, 'disabled')
              .then(function () {
                ret.exportListIndex = $scope.exportListIndex + batch.length;
                ret.percent = calcPercent(ret.exportListIndex);
                deferred.resolve(ret);
              })
              .catch(function () {
                deferred.reject(ret);
              });
          } else {
            deferred.resolve(ret);
          }
        } catch (error) {
          deferred.reject(error);
        }
        return deferred.promise;
      }
      
      function setTimeoutOrClose() {
        if ($scope.percent < 100) {
          setTimeout(processBatchCaller, 0);
        } else {
          $modalInstance.close('ok');
        }
      }

      function processBatchCaller() {
        processBatch()
          .then(function (processed) {
            if (_.isFunction(pluginData.processBatchPlugin)) {
              pluginData.processBatchPlugin(processed)
                .then(function (ret) {
                  $scope.percent = ret.percent;
                  $scope.exportListIndex = ret.exportListIndex;
                  setTimeoutOrClose();
                });
            } else {
              $scope.percent = processed.percent;
              $scope.exportListIndex = processed.exportListIndex;
              setTimeoutOrClose();
            }
          })
          .catch(function (error) {
            $scope.cancel();
          });
      }

      $scope.ok = function () {
        $scope.disableOk = true;
        if (_.isFunction($scope.startClickedPlugin)) {
          $scope.startClickedPlugin();
        }
        processBatchCaller();
      };
    });