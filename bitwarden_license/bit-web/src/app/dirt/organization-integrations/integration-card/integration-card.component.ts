import {
  AfterViewInit,
  Component,
  ElementRef,
  Inject,
  Input,
  OnDestroy,
  ViewChild,
} from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { Observable, Subject, combineLatest, lastValueFrom, takeUntil } from "rxjs";

import { SYSTEM_THEME_OBSERVABLE } from "@bitwarden/angular/services/injection-tokens";
import { Integration } from "@bitwarden/bit-common/dirt/organization-integrations/models/integration";
import { OrganizationIntegrationServiceType } from "@bitwarden/bit-common/dirt/organization-integrations/models/organization-integration-service-type";
import { OrganizationIntegrationType } from "@bitwarden/bit-common/dirt/organization-integrations/models/organization-integration-type";
import { DatadogOrganizationIntegrationService } from "@bitwarden/bit-common/dirt/organization-integrations/services/datadog-organization-integration-service";
import { HecOrganizationIntegrationService } from "@bitwarden/bit-common/dirt/organization-integrations/services/hec-organization-integration-service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ThemeType } from "@bitwarden/common/platform/enums";
import { ThemeStateService } from "@bitwarden/common/platform/theming/theme-state.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import {
  BaseCardComponent,
  CardContentComponent,
  DialogRef,
  DialogService,
  ToastService,
} from "@bitwarden/components";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

import {
  HecConnectDialogResult,
  DatadogConnectDialogResult,
  HecConnectDialogResultStatus,
  DatadogConnectDialogResultStatus,
  openDatadogConnectDialog,
  openHecConnectDialog,
} from "../integration-dialog/index";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-integration-card",
  templateUrl: "./integration-card.component.html",
  imports: [SharedModule, BaseCardComponent, CardContentComponent],
})
export class IntegrationCardComponent implements AfterViewInit, OnDestroy {
  private destroyed$: Subject<void> = new Subject();
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @ViewChild("imageEle") imageEle!: ElementRef<HTMLImageElement>;

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() name: string = "";
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() image: string = "";
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() imageDarkMode: string = "";
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() linkURL: string = "";
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() integrationSettings!: Integration;

  /** Adds relevant `rel` attribute to external links */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() externalURL?: boolean;

  /**
   * Date of when the new badge should be hidden.
   * When omitted, the new badge is never shown.
   *
   * @example "2024-12-31"
   */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() newBadgeExpiration?: string;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() description?: string;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() canSetupConnection?: boolean;

  organizationId: OrganizationId;

  constructor(
    private themeStateService: ThemeStateService,
    @Inject(SYSTEM_THEME_OBSERVABLE)
    private systemTheme$: Observable<ThemeType>,
    private dialogService: DialogService,
    private activatedRoute: ActivatedRoute,
    private hecOrganizationIntegrationService: HecOrganizationIntegrationService,
    private datadogOrganizationIntegrationService: DatadogOrganizationIntegrationService,
    private toastService: ToastService,
    private i18nService: I18nService,
  ) {
    this.organizationId = this.activatedRoute.snapshot.paramMap.get(
      "organizationId",
    ) as OrganizationId;
  }

  ngAfterViewInit() {
    combineLatest([this.themeStateService.selectedTheme$, this.systemTheme$])
      .pipe(takeUntil(this.destroyed$))
      .subscribe(([theme, systemTheme]) => {
        // When the card doesn't have a dark mode image, exit early
        if (!this.imageDarkMode) {
          return;
        }

        if (theme === ThemeType.System) {
          // When the user's preference is the system theme,
          // use the system theme to determine the image
          const prefersDarkMode = systemTheme === ThemeType.Dark;

          this.imageEle.nativeElement.src = prefersDarkMode ? this.imageDarkMode : this.image;
        } else if (theme === ThemeType.Dark) {
          // When the user's preference is dark mode, use the dark mode image
          this.imageEle.nativeElement.src = this.imageDarkMode;
        } else {
          // Otherwise use the light mode image
          this.imageEle.nativeElement.src = this.image;
        }
      });
  }

  ngOnDestroy(): void {
    this.destroyed$.next();
    this.destroyed$.complete();
  }

  /** Show the "new" badge when expiration is in the future */
  showNewBadge() {
    if (!this.newBadgeExpiration) {
      return false;
    }

    const expirationDate = new Date(this.newBadgeExpiration);

    // Do not show the new badge for invalid dates
    if (isNaN(expirationDate.getTime())) {
      return false;
    }

    return expirationDate > new Date();
  }

  get isConnected(): boolean {
    return !!this.integrationSettings.organizationIntegration?.configuration;
  }

  showConnectedBadge(): boolean {
    return this.canSetupConnection ?? false;
  }

  get isUpdateAvailable(): boolean {
    return !!this.integrationSettings.organizationIntegration;
  }

  async setupConnection() {
    let dialog: DialogRef<DatadogConnectDialogResult | HecConnectDialogResult, unknown>;

    if (this.integrationSettings?.integrationType === null) {
      return;
    }

    if (this.integrationSettings?.integrationType === OrganizationIntegrationType.Datadog) {
      dialog = openDatadogConnectDialog(this.dialogService, {
        data: {
          settings: this.integrationSettings,
        },
      });

      const result = await lastValueFrom(dialog.closed);

      // the dialog was cancelled
      if (!result || !result.success) {
        return;
      }

      try {
        if (result.success === HecConnectDialogResultStatus.Delete) {
          await this.deleteDatadog();
        }
      } catch {
        this.toastService.showToast({
          variant: "error",
          title: "",
          message: this.i18nService.t("failedToDeleteIntegration"),
        });
      }

      try {
        if (result.success === DatadogConnectDialogResultStatus.Edited) {
          await this.saveDatadog(result as DatadogConnectDialogResult);
        }
      } catch {
        this.toastService.showToast({
          variant: "error",
          title: "",
          message: this.i18nService.t("failedToSaveIntegration"),
        });
      }
    } else {
      // invoke the dialog to connect the integration
      dialog = openHecConnectDialog(this.dialogService, {
        data: {
          settings: this.integrationSettings,
        },
      });

      const result = await lastValueFrom(dialog.closed);

      // the dialog was cancelled
      if (!result || !result.success) {
        return;
      }

      try {
        if (result.success === HecConnectDialogResultStatus.Delete) {
          await this.deleteHec();
        }
      } catch {
        this.toastService.showToast({
          variant: "error",
          title: "",
          message: this.i18nService.t("failedToDeleteIntegration"),
        });
      }

      try {
        if (result.success === HecConnectDialogResultStatus.Edited) {
          await this.saveHec(result as HecConnectDialogResult);
        }
      } catch {
        this.toastService.showToast({
          variant: "error",
          title: "",
          message: this.i18nService.t("failedToSaveIntegration"),
        });
      }
    }
  }

  async saveHec(result: HecConnectDialogResult) {
    let saveResponse = { mustBeOwner: false, success: false };
    if (this.isUpdateAvailable) {
      // retrieve org integration and configuration ids
      const orgIntegrationId = this.integrationSettings.organizationIntegration?.id;
      const orgIntegrationConfigurationId =
        this.integrationSettings.organizationIntegration?.integrationConfiguration[0]?.id;

      if (!orgIntegrationId || !orgIntegrationConfigurationId) {
        throw Error("Organization Integration ID or Configuration ID is missing");
      }

      // update existing integration and configuration
      saveResponse = await this.hecOrganizationIntegrationService.updateHec(
        this.organizationId,
        orgIntegrationId,
        orgIntegrationConfigurationId,
        this.integrationSettings.name as OrganizationIntegrationServiceType,
        result.url,
        result.bearerToken,
        result.index,
      );
    } else {
      // create new integration and configuration
      saveResponse = await this.hecOrganizationIntegrationService.saveHec(
        this.organizationId,
        this.integrationSettings.name as OrganizationIntegrationServiceType,
        result.url,
        result.bearerToken,
        result.index,
      );
    }

    if (saveResponse.mustBeOwner) {
      this.showMustBeOwnerToast();
      return;
    }

    this.toastService.showToast({
      variant: "success",
      title: "",
      message: this.i18nService.t("success"),
    });
  }

  async deleteHec() {
    const orgIntegrationId = this.integrationSettings.organizationIntegration?.id;
    const orgIntegrationConfigurationId =
      this.integrationSettings.organizationIntegration?.integrationConfiguration[0]?.id;

    if (!orgIntegrationId || !orgIntegrationConfigurationId) {
      throw Error("Organization Integration ID or Configuration ID is missing");
    }

    const response = await this.hecOrganizationIntegrationService.deleteHec(
      this.organizationId,
      orgIntegrationId,
      orgIntegrationConfigurationId,
    );

    if (response.mustBeOwner) {
      this.showMustBeOwnerToast();
      return;
    }

    this.toastService.showToast({
      variant: "success",
      title: "",
      message: this.i18nService.t("success"),
    });
  }

  async saveDatadog(result: DatadogConnectDialogResult) {
    if (this.isUpdateAvailable) {
      // retrieve org integration and configuration ids
      const orgIntegrationId = this.integrationSettings.organizationIntegration?.id;
      const orgIntegrationConfigurationId =
        this.integrationSettings.organizationIntegration?.integrationConfiguration[0]?.id;

      if (!orgIntegrationId || !orgIntegrationConfigurationId) {
        throw Error("Organization Integration ID or Configuration ID is missing");
      }

      // update existing integration and configuration
      await this.datadogOrganizationIntegrationService.updateDatadog(
        this.organizationId,
        orgIntegrationId,
        orgIntegrationConfigurationId,
        this.integrationSettings.name as OrganizationIntegrationServiceType,
        result.url,
        result.apiKey,
      );
    } else {
      // create new integration and configuration
      await this.datadogOrganizationIntegrationService.saveDatadog(
        this.organizationId,
        this.integrationSettings.name as OrganizationIntegrationServiceType,
        result.url,
        result.apiKey,
      );
    }
    this.toastService.showToast({
      variant: "success",
      title: "",
      message: this.i18nService.t("success"),
    });
  }

  async deleteDatadog() {
    const orgIntegrationId = this.integrationSettings.organizationIntegration?.id;
    const orgIntegrationConfigurationId =
      this.integrationSettings.organizationIntegration?.integrationConfiguration[0]?.id;

    if (!orgIntegrationId || !orgIntegrationConfigurationId) {
      throw Error("Organization Integration ID or Configuration ID is missing");
    }

    const response = await this.datadogOrganizationIntegrationService.deleteDatadog(
      this.organizationId,
      orgIntegrationId,
      orgIntegrationConfigurationId,
    );

    if (response.mustBeOwner) {
      this.showMustBeOwnerToast();
      return;
    }

    this.toastService.showToast({
      variant: "success",
      title: "",
      message: this.i18nService.t("success"),
    });
  }

  private showMustBeOwnerToast() {
    this.toastService.showToast({
      variant: "error",
      title: "",
      message: this.i18nService.t("mustBeOrgOwnerToPerformAction"),
    });
  }
}
