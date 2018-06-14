﻿//-----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// Licensed under the MIT License. See License file under the project root for license information.
//-----------------------------------------------------------------------------

module Sfx {

    export interface IAppsViewScope extends angular.IScope {
        apps: ApplicationCollection;
        appTypes: ApplicationTypeCollection;
        actions: ActionCollection;
        listSettings: ListSettings;
        applicationTypeListSettings: ListSettings;
        upgradeAppsListSettings: ListSettings;
        upgradeProgresses: ApplicationUpgradeProgress[];
    }

    export class AppsViewController extends MainViewController {
        constructor($injector: angular.auto.IInjectorService, public $scope: IAppsViewScope) {
            super($injector, {
                "applications": { name: "Applications" },
                "upgrades": { name: "Upgrades in Progress", superscriptClass: "tab-superscript-number" }
            });

            $scope.actions = new ActionCollection(this.data.telemetry, this.data.$q);

            if (this.data.actionsEnabled()) {
                this.setupActions(this.$scope.actions);
            }

            this.tabs["upgrades"].refresh = (messageHandler) => this.refreshUpgradesTab(messageHandler);

            this.selectTreeNode([
                IdGenerator.cluster(),
                IdGenerator.appGroup()
            ]);

            this.$scope.listSettings = this.settings.getNewOrExistingListSettings("apps", ["name"], [
                new ListColumnSettingForLink("name", "Name", item => item.viewPath),
                new ListColumnSetting("applicationTypeName", "Application Type"),
                new ListColumnSetting("applicationTypeVersion", "Version"),
                new ListColumnSettingWithFilter("raw.Status", "Status")
            ]);

            this.$scope.applicationTypeListSettings = this.settings.getNewOrExistingListSettings(
                "appTypes",
                ["name"],
                [
                    new ListColumnSetting("name", "Name"),
                    new ListColumnSetting("raw.Version", "Version"),
                    new ListColumnSetting("raw.Status", "Status"),
                    new ListColumnSetting("actions", "Actions", null, false, (item) => `<${Constants.DirectiveNameActionsRow} actions="item.actions" source="serviceTypesTable"></${Constants.DirectiveNameActionsRow}>`)
                ],
                [ new ListColumnSetting("packages", "Packages", null, false, (item) => `<sfx-app-type-package apptype="item"></sfx-app-type-package>`, 4) ],
                true,
                () => false);
            this.$scope.applicationTypeListSettings.secondRowCollapsedByDefault = true;

            this.$scope.upgradeAppsListSettings = this.settings.getNewOrExistingListSettings("upgrades", ["name"], [
                new ListColumnSettingForLink("name", "Name", item => item.viewPath),
                new ListColumnSettingForLink("parent.raw.TypeName", "Application Type", item => item.parent.appTypeViewPath),
                new ListColumnSetting("parent.raw.TypeVersion", "Current Version"),
                new ListColumnSetting("raw.TargetApplicationTypeVersion", "Target Version"),
                new ListColumnSetting("upgrade", "Progress by Upgrade Domain", null, false, (item) => HtmlUtils.getUpgradeProgressHtml("item.upgradeDomains")),
                new ListColumnSettingWithFilter("raw.UpgradeState", "Upgrade State")
            ]);

            this.refresh();
        }

        protected refreshCommon(messageHandler?: IResponseMessageHandler): angular.IPromise<any> {
            return this.$q.all([
                this.data.getApps(true, messageHandler).then(apps => {
                    this.$scope.apps = apps;

                    if (this.$scope.apps.upgradingAppCount > 0) {
                        this.tabs["upgrades"].superscriptInHtml = () => this.$scope.apps.upgradingAppCount.toString();
                    } else {
                        this.tabs["upgrades"].superscriptInHtml = null;
                    }
                }),
                this.data.getAppTypes(true).then(types => {
                    _.map(types.collection, appType => appType.serviceTypes.refresh(messageHandler).then(() => {
                        _.map(appType.serviceTypes.collection, serviceType => serviceType.manifest.refresh(messageHandler));
                    }));

                    this.$scope.appTypes = types;
                })]);
        }

        private refreshUpgradesTab(messageHandler?: IResponseMessageHandler): angular.IPromise<any> {
            let promises = _.map(_.filter(this.$scope.apps.collection, app => app.isUpgrading), app => app.upgradeProgress.refresh(messageHandler));

            return this.$q.all(promises).then(() => {
                this.$scope.upgradeProgresses = _.map(_.filter(this.$scope.apps.collection, app => app.isUpgrading), app => app.upgradeProgress);
            });
        }

        private setupActions(actions: ActionCollection) {
            actions.add(new ActionCreateComposeApplication(this.data));
        }
    }

    export class ActionCreateComposeApplication extends ActionWithDialog {

        public applicationName: string;

        public composeFileContent: string;

        public hasRepositoryCredential: boolean;

        public repositoryUserName: string;

        public repositoryPassword: string;

        public passwordEncrypted: boolean;

        public composeFileName: string;

        public loadComposeFile($event: ng.IAngularEvent): void {
            console.log($event);
        }

        constructor(data: DataService) {

            super(
                data.$uibModal,
                data.$q,
                "createComposeApplication",
                "Create compose application",
                "Creating",
                () => data.restClient.createComposeDeployment(this.createComposeDeploymentDescription()),
                () => true,
                <angular.ui.bootstrap.IModalSettings>{
                    templateUrl: "partials/create-compose-application-dialog.html",
                    controller: ActionController,
                    resolve: {
                        action: () => this
                    }
                },
                null);

            this.reset();
        }

        private reset(): void {
            this.applicationName = "";
            this.composeFileContent = "";
            this.hasRepositoryCredential = false;
            this.repositoryUserName = "";
            this.repositoryPassword = "";
            this.passwordEncrypted = false;
        }

        private createComposeDeploymentDescription(): IRawCreateComposeDeploymentDescription {
            let description: IRawCreateComposeDeploymentDescription = {
                DeploymentName: this.applicationName,
                ComposeFileContent: this.composeFileContent
            };

            if (this.hasRepositoryCredential) {
                description.RepositoryCredential = {
                    RepositoryUserName: this.repositoryUserName,
                    RepositoryPassword: this.repositoryPassword,
                    PasswordEncrypted: this.passwordEncrypted
                };
            }

            return description;
        }
    }

    (function () {

        let module = angular.module("appsViewController", ["ngRoute", "dataService"]);

        module.controller("AppsViewController", ["$injector", "$scope", AppsViewController]);
    })();
}
