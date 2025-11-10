# Sample XML Invoices

This folder contains sample XML invoice files in UBL 2.1 format compatible with Peppol network.

## File Structure

- `sample-invoice-1.xml` - Basic invoice example with single line item
- You can add more sample invoices here for testing

## Usage

These sample XML files can be used for:
- Testing the document send functionality
- Validating invoice parsing logic
- Demo purposes during development
- Integration testing with the ion-AP API

## Format

All invoices follow the UBL 2.1 (Universal Business Language) standard and are compliant with:
- EN16931 (European Standard for electronic invoicing)
- Peppol BIS Billing 3.0

## Adding New Samples

To add new sample invoices:
1. Create a new `.xml` file in this directory
2. Ensure it follows UBL 2.1 format
3. Use valid Peppol endpoint IDs (schemeID format: `9950:xxxxxxxxxx`)
4. Include all required fields: ID, dates, parties, amounts, tax information
