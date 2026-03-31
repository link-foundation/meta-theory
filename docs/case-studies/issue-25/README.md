# Case Study: Issue #25 - Remove Consent Modal Dialog and `article.png` from Archived Versions

## Overview

**Issue:** [#25 - Remove consent modal dialog and `article.png` from archived versions of articles](https://github.com/link-foundation/meta-theory/issues/25)
**Pull Request:** [#26](https://github.com/link-foundation/meta-theory/pull/26)
**Date:** March 31, 2026
**Status:** Resolved

## Problem Statement

Two issues were identified with the archived article screenshots:

1. **Consent modal dialog in screenshots**: The `article-dark.png` and `article-light.png` screenshots for archived articles contained a Google Funding Choices (FC) consent dialog overlay, obscuring the article content.

2. **Redundant `article.png` files**: Each archive version contained an `article.png` file that was simply a copy of `article-light.png`, created for backward compatibility. Since both `article-light.png` and `article-dark.png` themed versions are now standard, the duplicate `article.png` is unnecessary.

## Timeline of Events

### Prior Context
- **Issue #21 / PR #22** (Mar 2026): Added light/dark themed screenshot capture with `closePopups()` function. The `article.png` was kept as a backward-compatible copy of the light theme screenshot.
- **Issue #25** (Mar 2026): Reported that consent modal dialog was still visible in screenshots despite the popup-closing logic.

### Investigation (March 31, 2026)

1. **Screenshot analysis**: Examined `archive/0.0.2/article-dark.png` and `archive/0.0.2/article-light.png` to confirm the consent modal was present. The light theme screenshots clearly showed the consent dialog.

2. **Consent modal detection experiment**: Created `experiments/detect-consent-modal.mjs` to analyze what overlay elements appear on Habr pages. Key findings:
   - The consent dialog is a **Google Funding Choices (FC)** consent management dialog
   - FC dialog elements use the `fc-` CSS class prefix (e.g., `fc-consent-root`, `fc-dialog`, `fc-cta-consent`)
   - The dialog appears primarily in **light theme** mode
   - In dark theme, the consent dialog was sometimes not shown (possibly due to geolocation or cookie state)

3. **Root cause identification**: The existing `closePopups()` function in `download.mjs` had selectors for Habr's native popups (`.tm-cookie-banner__close`, `.consent-popup__close`, etc.) but **did not have selectors for Google Funding Choices elements**.

4. **Fix implementation and verification**: Updated `closePopups()`, removed `article.png` files, re-captured all screenshots, and verified all tests pass at 100%.

## Root Cause Analysis

### Root Cause 1: Missing Google FC Consent Dialog Selectors

**Problem:** The `closePopups()` function in `scripts/download.mjs` attempted to close consent popups using Habr-specific CSS selectors, but Habr uses Google's Funding Choices consent management platform which uses its own class naming convention with the `fc-` prefix.

**Evidence:** The experiment `detect-consent-modal.mjs` found the following FC elements on the page:
- `.fc-consent-root` - Root container for the entire consent dialog
- `.fc-dialog-overlay` - Semi-transparent background overlay
- `.fc-dialog-container` / `.fc-dialog` - The dialog box itself
- `.fc-cta-consent` - The "Consent" button (primary action)
- `.fc-cta-manage-options` - The "Manage options" button (secondary action)

**Fix:** Added three-pronged approach to dismiss FC consent dialogs:
1. **Click the consent button** (`.fc-cta-consent`) first as the most reliable dismissal
2. **Remove FC elements from DOM** (`.fc-consent-root`, `.fc-dialog-overlay`) to ensure they don't appear in screenshots
3. **Added FC pattern** (`fc-`) to the fixed-position overlay detection regex

### Root Cause 2: Redundant `article.png` Files

**Problem:** The `captureScreenshot()` function copied `article-light.png` to `article.png` after each capture, creating an unnecessary duplicate file.

**Fix:** Removed the copy operation and deleted all existing `article.png` files from archive directories. Updated `articles-config.mjs` to remove the `screenshotFile` property.

## Solution Details

### Files Modified

1. **`scripts/download.mjs`**:
   - Enhanced `closePopups()` with Google FC consent dialog handling
   - Removed `article.png` backward-compatibility copy logic

2. **`scripts/articles-config.mjs`**:
   - Removed `screenshotFile` property from all article configurations

3. **`archive/0.0.0/article.png`**, **`archive/0.0.1/article.png`**, **`archive/0.0.2/article.png`**:
   - Deleted (redundant files)

4. **`archive/*/article-light.png`**, **`archive/*/article-dark.png`**:
   - Re-captured with consent modal properly dismissed

### Google Funding Choices (FC) Technical Details

Google Funding Choices is a consent management platform (CMP) that implements the IAB Europe Transparency and Consent Framework (TCF). It is commonly used by European-audience websites to comply with GDPR cookie consent requirements.

Key technical characteristics:
- **CSS class prefix**: `fc-` (e.g., `fc-dialog`, `fc-consent-root`)
- **Dialog structure**: Uses a fixed-position overlay + dialog container pattern
- **Consent button**: `.fc-cta-consent.fc-primary-button`
- **Management button**: `.fc-cta-manage-options.fc-secondary-button`
- **Root element**: `.fc-consent-root` (contains everything)
- **Overlay**: `.fc-dialog-overlay` (semi-transparent background)

## Verification Results

All articles pass verification at 100% after changes:

| Version | Article | Pass Rate |
|---------|---------|-----------|
| 0.0.0 | Math introduction to Deep Theory | 100% (35/35) |
| 0.0.1 | Deep Theory of Links 0.0.1 | 100% (92/92) |
| 0.0.2 | The Links Theory 0.0.2 | 100% (95/95) |

## Data Files

- `consent-modal-analysis.txt` - Full output from consent modal detection experiment
- `screenshot-capture.log` - Log from re-capturing all screenshots
- `verify-all.txt` - Verification results after fix
