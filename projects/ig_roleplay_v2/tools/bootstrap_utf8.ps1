# Normalize Windows PowerShell and child-process IO to UTF-8 so Chinese
# text survives across local logging, docker exec, Python, and JSON reads.
$utf8NoBom = New-Object System.Text.UTF8Encoding $false

try {
  cmd /c chcp 65001 > $null
} catch {
}

[Console]::InputEncoding = $utf8NoBom
[Console]::OutputEncoding = $utf8NoBom
$global:OutputEncoding = $utf8NoBom

$PSDefaultParameterValues['Get-Content:Encoding'] = 'utf8'
$PSDefaultParameterValues['Set-Content:Encoding'] = 'utf8'
$PSDefaultParameterValues['Add-Content:Encoding'] = 'utf8'
$PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'
$PSDefaultParameterValues['Export-Csv:Encoding'] = 'utf8'

$env:PYTHONIOENCODING = 'utf-8'
$env:PYTHONUTF8 = '1'
$env:LANG = 'C.UTF-8'
$env:LC_ALL = 'C.UTF-8'
