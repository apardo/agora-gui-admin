angular.module('avAdmin')
  .controller('EditCalculateResultsJsonModal',
    function($scope, $modalInstance, payload)
    {
      $scope.calculateResultsJson = {
        model: angular.fromJson(payload)
      };

      $scope.ok = function () {
        $modalInstance.close({electionJson: $scope.calculateResultsJson.model});
      };

      $scope.cancel = function () {
        $modalInstance.dismiss('cancel');
      };
    });
