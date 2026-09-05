# Adds one named account to the built-in Performance Log Users group.
# This script is launched only after the user selects “Fix FPS access” and
# Windows approves an elevation prompt. A fresh sign-in is required afterward.
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[^\r\n]+$')]
    [string]$Member
)

$ErrorActionPreference = 'Stop'
$groupSid = [System.Security.Principal.SecurityIdentifier]::new('S-1-5-32-559')
$group = Get-LocalGroup -SID $groupSid
$memberSid = ([System.Security.Principal.NTAccount]::new($Member)).Translate([System.Security.Principal.SecurityIdentifier]).Value
$existing = @(Get-LocalGroupMember -Group $group | ForEach-Object { $_.SID.Value })

if ($existing -notcontains $memberSid) {
    Add-LocalGroupMember -Group $group -Member $Member
}

[pscustomobject]@{ member = $Member; changed = ($existing -notcontains $memberSid) } | ConvertTo-Json -Compress
