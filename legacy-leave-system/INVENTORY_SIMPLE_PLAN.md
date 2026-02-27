# Simple Inventory Tracking System

## What We're Building

A straightforward inventory management system to track items, their costs, and calculate profit/loss.

## Core Features

### 1. Add Inventory Item
Simple form with:
- Item description
- Quantity
- Unit of measure (pcs, kg, etc.)
- Acquisition cost (what you paid per unit)
- Selling price (what you sold it for per unit) - optional
- Status (Available, Sold, Damaged)
- Remarks

### 2. Inventory List
Table showing:
- Item description
- Quantity
- Acquisition cost
- Selling price
- Profit/Loss (auto-calculated)
- Status
- Actions (Edit, Delete)

### 3. Dashboard Summary
Cards showing:
- Total items
- Total acquisition cost
- Total selling amount
- Total profit/loss
- Items by status

### 4. Calculations

**Per Item:**
```
Total Acquisition Cost = Quantity × Unit Acquisition Cost
Total Selling Amount = Quantity × Unit Selling Price
Profit/Loss = Total Selling Amount - Total Acquisition Cost
```

**Overall:**
```
Total Profit/Loss = Sum of all items' profit/loss
```

## Simplified Workflow

1. **Add Item** → Enter details → Save
2. **View List** → See all items with profit/loss
3. **Edit Item** → Update selling price when sold
4. **View Summary** → See overall profit/loss

## UI Pages

1. **Dashboard** (`/inventory`) - Summary cards + recent items
2. **All Items** (`/inventory/items`) - Full list with filters
3. **Add Item** (`/inventory/add`) - Simple form
4. **Edit Item** (`/inventory/[id]/edit`) - Update form

## Status Options

- **Available** - In stock, not sold yet
- **Sold** - Item has been sold
- **Damaged** - Item is damaged (can still track cost)

## No Complex Workflows

- No approval process
- No incident reporting
- No compensation tracking
- Just simple: Add → Track → Calculate

This is much simpler and focused on what you need!
