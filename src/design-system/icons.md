# Icon System - Whitelisted Icons

Standardized icon set for consistency. Use ONLY these icons from `lucide-react`.

## Navigation & Structure (6 icons)

- `Home` - Dashboard/home
- `Menu` - Mobile menu toggle
- `X` - Close/dismiss
- `ChevronDown` - Expand/collapse down
- `ChevronUp` - Expand/collapse up
- `ChevronRight` - Forward/next

## Actions (8 icons)

- `Plus` / `PlusCircle` - Add/create
- `Edit` / `Pencil` - Edit
- `Trash2` - Delete
- `Save` - Save
- `Download` - Export/download
- `Upload` - Import/upload
- `RefreshCw` - Refresh/sync
- `Check` - Confirm/success

## Finance & Data (6 icons)

- `DollarSign` - Money/payments
- `TrendingUp` - Growth/profit
- `TrendingDown` - Loss/decline
- `Calendar` - Dates/schedule
- `Clock` - Time tracking
- `FileText` - Documents/reports

## Status & Feedback (5 icons)

- `AlertCircle` - Warning
- `XCircle` - Error
- `CheckCircle` - Success
- `Info` - Information
- `AlertTriangle` - Critical warning

## User & Access (4 icons)

- `User` - User profile
- `Users` - Team/employees
- `Lock` - Security/private
- `LogOut` - Sign out

## Utilities (4 icons)

- `Settings` - Configuration
- `Search` - Search functionality
- `Filter` - Filtering options
- `MoreVertical` / `MoreHorizontal` - More actions menu

## Total: ~30 icons (consolidated from 50+)

## Usage Rules

1. **Import from centralized icon exports:**

   ```tsx
   // ✅ Create src/design-system/icons.ts with named exports
   import { IconHome, IconMenu, IconPlus } from "@/design-system/icons";
   ```

2. **Consistent sizing:**
   - Default: `size={20}` (20px)
   - Small: `size={16}` (16px)
   - Large: `size={24}` (24px)

3. **Accessible labels:**

   ```tsx
   <button aria-label="Add item">
     <IconPlus size={20} />
   </button>
   ```

4. **Color inheritance:**
   - Icons should inherit text color via `currentColor`
   - No hardcoded stroke/fill colors

## Migration Notes

Icons to replace:

- Any custom SVG icons → Use lucide equivalents
- Emoji icons (🏠 📊 etc.) → Use lucide icons
- Multiple similar icons → Consolidate to one (e.g., `Edit` OR `Pencil`, not both)
