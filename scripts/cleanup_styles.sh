#!/bin/bash
DIR="apps/intranet/src"

replace() {
    search="$1"
    replacement="$2"
    find "$DIR" -type f \( -name "*.tsx" -o -name "*.ts" -o -name "*.jsx" -o -name "*.js" \) -exec sed -i "s|$search|$replacement|g" {} +
}

replace "text-warning-content" "text-warning-foreground"
replace "text-success-content" "text-success-foreground"
replace "text-error-content" "text-danger-foreground"
replace "text-info-content" "text-info-foreground"
replace "text-primary-content" "text-primary-foreground"
replace "text-secondary-content" "text-secondary-foreground"

replace "bg-warning-content" "bg-warning-foreground"
replace "bg-success-content" "bg-success-foreground"
replace "bg-error-content" "bg-danger-foreground"
replace "bg-info-content" "bg-info-foreground"
replace "bg-primary-content" "bg-primary-foreground"
replace "bg-secondary-content" "bg-secondary-foreground"

# Catch legacy glass classes if any
replace "glass" "backdrop-blur-md bg-white/30"

echo "Cleanup script finished."
