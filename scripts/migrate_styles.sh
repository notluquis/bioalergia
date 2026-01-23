#!/bin/bash

# Define the directory
DIR="apps/web/src"

# Function to perform replacement
replace() {
    search="$1"
    replacement="$2"
    echo "Replacing $search with $replacement..."
    find "$DIR" -type f \( -name "*.tsx" -o -name "*.ts" -o -name "*.jsx" -o -name "*.js" \) -exec sed -i "s|$search|$replacement|g" {} +
}

# Colors
replace "bg-base-100" "bg-background"
replace "bg-base-200" "bg-default-50"
replace "bg-base-300" "bg-default-100"

# Text Opacities (Order matters: specific to general)
replace "text-base-content\/90" "text-foreground\/90"
replace "text-base-content\/80" "text-default-700"
replace "text-base-content\/70" "text-default-600"
replace "text-base-content\/60" "text-default-500"
replace "text-base-content\/50" "text-default-400"
replace "text-base-content\/40" "text-default-300"
replace "text-base-content\/30" "text-default-200"
replace "text-base-content\/20" "text-default-100"
replace "text-base-content\/10" "text-default-50"

# Base Content Text
replace "text-base-content" "text-foreground"

# Borders
replace "border-base-200" "border-default-100"
replace "border-base-300" "border-default-200"
replace "border-base-content\/5" "border-default-100"
replace "border-base-content\/10" "border-default-200"
replace "border-base-content\/20" "border-default-300"

# Backgrounds with base-content
replace "bg-base-content\/5" "bg-default-50"
replace "bg-base-content\/10" "bg-default-100"
replace "bg-base-content\/20" "bg-default-200"
replace "bg-base-content\/30" "bg-default-300"

# Dividers
replace "divide-base-content\/5" "divide-default-100"
replace "divide-base-content\/10" "divide-default-200"

# Error -> Danger
replace "bg-error\/10" "bg-danger\/10"
replace "text-error" "text-danger"
replace "border-error" "border-danger"
replace "bg-error" "bg-danger"

echo "Migration script finished."
