 = 'src/app/features/calendar/drawer/event-drawer/event-drawer.component.ts'
 = Get-Content  -Raw
 = '(?s)\\s+private readonly bookingQueryText\\$[\\s\\S]*?(?=\\r?\\n  // ---------------------------------------------)'
if (-not ( -match )) { throw 'pattern not found' }
 = [regex]::Replace(, , '\\n')
Set-Content -Path  -Value 
