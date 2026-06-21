param(
    [string]$Root = (Join-Path $PSScriptRoot '..\src')
)

# Files that ALREADY have dark: classes added manually (do not touch).
$skipFiles = @(
    'Home.tsx',
    'Saved.tsx',
    'History.tsx',
    'BottomNav.tsx',
    'App.tsx',
    'useTheme.ts',
    'backup.ts'
)

# Each entry: regex Pattern matched only when not adjacent to existing class
# punctuation, and a Replace string that appends a dark: variant.
$rules = @(
    # Backgrounds — generic surfaces
    @{ P = '(?<![\w:/-])bg-white(?![\w/-])'; R = 'bg-white dark:bg-slate-800' },
    @{ P = '(?<![\w:/-])bg-slate-50(?![\w/-])'; R = 'bg-slate-50 dark:bg-slate-800/60' },
    @{ P = '(?<![\w:/-])bg-slate-100(?![\w/-])'; R = 'bg-slate-100 dark:bg-slate-700/60' },
    # Borders
    @{ P = '(?<![\w:/-])border-slate-200(?![\w/-])'; R = 'border-slate-200 dark:border-slate-700' },
    @{ P = '(?<![\w:/-])border-slate-300(?![\w/-])'; R = 'border-slate-300 dark:border-slate-600' },
    @{ P = '(?<![\w:/-])border-slate-100(?![\w/-])'; R = 'border-slate-100 dark:border-slate-700/60' },
    # Text colors
    @{ P = '(?<![\w:/-])text-slate-900(?![\w/-])'; R = 'text-slate-900 dark:text-slate-100' },
    @{ P = '(?<![\w:/-])text-slate-800(?![\w/-])'; R = 'text-slate-800 dark:text-slate-200' },
    @{ P = '(?<![\w:/-])text-slate-700(?![\w/-])'; R = 'text-slate-700 dark:text-slate-300' },
    @{ P = '(?<![\w:/-])text-slate-600(?![\w/-])'; R = 'text-slate-600 dark:text-slate-400' },
    @{ P = '(?<![\w:/-])text-slate-500(?![\w/-])'; R = 'text-slate-500 dark:text-slate-400' },
    @{ P = '(?<![\w:/-])text-slate-400(?![\w/-])'; R = 'text-slate-400 dark:text-slate-500' },
    @{ P = '(?<![\w:/-])placeholder-slate-400(?![\w/-])'; R = 'placeholder-slate-400 dark:placeholder-slate-500' },
    # Sky accents
    @{ P = '(?<![\w:/-])bg-sky-50(?![\w/-])'; R = 'bg-sky-50 dark:bg-sky-900/40' },
    @{ P = '(?<![\w:/-])bg-sky-100(?![\w/-])'; R = 'bg-sky-100 dark:bg-sky-900/60' },
    @{ P = '(?<![\w:/-])text-sky-700(?![\w/-])'; R = 'text-sky-700 dark:text-sky-300' },
    @{ P = '(?<![\w:/-])text-sky-600(?![\w/-])'; R = 'text-sky-600 dark:text-sky-400' },
    @{ P = '(?<![\w:/-])text-sky-800(?![\w/-])'; R = 'text-sky-800 dark:text-sky-200' },
    # Emerald
    @{ P = '(?<![\w:/-])bg-emerald-50(?![\w/-])'; R = 'bg-emerald-50 dark:bg-emerald-900/40' },
    @{ P = '(?<![\w:/-])bg-emerald-100(?![\w/-])'; R = 'bg-emerald-100 dark:bg-emerald-900/60' },
    @{ P = '(?<![\w:/-])text-emerald-700(?![\w/-])'; R = 'text-emerald-700 dark:text-emerald-300' },
    @{ P = '(?<![\w:/-])text-emerald-800(?![\w/-])'; R = 'text-emerald-800 dark:text-emerald-200' },
    @{ P = '(?<![\w:/-])text-emerald-900(?![\w/-])'; R = 'text-emerald-900 dark:text-emerald-100' },
    @{ P = '(?<![\w:/-])border-emerald-200(?![\w/-])'; R = 'border-emerald-200 dark:border-emerald-700' },
    # Amber
    @{ P = '(?<![\w:/-])bg-amber-50(?![\w/-])'; R = 'bg-amber-50 dark:bg-amber-900/40' },
    @{ P = '(?<![\w:/-])bg-amber-100(?![\w/-])'; R = 'bg-amber-100 dark:bg-amber-900/60' },
    @{ P = '(?<![\w:/-])text-amber-700(?![\w/-])'; R = 'text-amber-700 dark:text-amber-300' },
    @{ P = '(?<![\w:/-])text-amber-800(?![\w/-])'; R = 'text-amber-800 dark:text-amber-200' },
    @{ P = '(?<![\w:/-])text-amber-900(?![\w/-])'; R = 'text-amber-900 dark:text-amber-100' },
    @{ P = '(?<![\w:/-])border-amber-200(?![\w/-])'; R = 'border-amber-200 dark:border-amber-700' },
    @{ P = '(?<![\w:/-])border-amber-300(?![\w/-])'; R = 'border-amber-300 dark:border-amber-700' },
    # Red / Rose
    @{ P = '(?<![\w:/-])bg-red-50(?![\w/-])'; R = 'bg-red-50 dark:bg-red-900/40' },
    @{ P = '(?<![\w:/-])text-red-700(?![\w/-])'; R = 'text-red-700 dark:text-red-300' },
    @{ P = '(?<![\w:/-])text-red-600(?![\w/-])'; R = 'text-red-600 dark:text-red-400' },
    @{ P = '(?<![\w:/-])bg-rose-100(?![\w/-])'; R = 'bg-rose-100 dark:bg-rose-900/60' },
    @{ P = '(?<![\w:/-])text-rose-700(?![\w/-])'; R = 'text-rose-700 dark:text-rose-300' }
)

$files = Get-ChildItem -Path $Root -Include *.tsx, *.ts -Recurse -File
$touched = 0
foreach ($file in $files) {
    if ($skipFiles -contains $file.Name) { continue }
    $orig = Get-Content $file.FullName -Raw -Encoding UTF8
    if ($null -eq $orig) { continue }
    $new = $orig
    foreach ($rule in $rules) {
        $new = [regex]::Replace($new, $rule.P, $rule.R)
    }
    if ($new -ne $orig) {
        Set-Content -LiteralPath $file.FullName -Value $new -Encoding UTF8 -NoNewline
        Write-Host "patched: $($file.Name)"
        $touched++
    }
}
Write-Host "`nfiles touched: $touched"
