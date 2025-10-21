import { CurrencyPipe } from "@angular/common";
import { Component, EventEmitter, input, Output } from "@angular/core";

import {
  BadgeModule,
  BadgeVariant,
  ButtonModule,
  ButtonType,
  IconModule,
  TypographyModule,
} from "@bitwarden/components";

/**
 * A reusable UI-only component that displays pricing information in a card format.
 * This component has no external dependencies and performs no logic - it only displays data
 * and emits events when the button is clicked.
 */
@Component({
  selector: "billing-pricing-card",
  templateUrl: "./pricing-card.component.html",
  imports: [BadgeModule, ButtonModule, IconModule, TypographyModule, CurrencyPipe],
})
export class PricingCardComponent {
  readonly tagline = input.required<string>();
  readonly price = input<{
    amount: number;
    cadence: "monthly" | "annually";
    showPerUser?: boolean;
  }>();
  readonly button = input<{
    type: ButtonType;
    text: string;
    disabled?: boolean;
    icon?: { type: string; position: "before" | "after" };
  }>();
  readonly features = input<string[]>();
  readonly activeBadge = input<{ text: string; variant?: BadgeVariant }>();

  @Output() buttonClick = new EventEmitter<void>();

  /**
   * Handles button click events and emits the buttonClick event
   */
  onButtonClick(): void {
    this.buttonClick.emit();
  }
}
