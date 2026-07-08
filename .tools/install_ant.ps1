if (-not (Test-Path ".tools")) { New-Item -ItemType Directory -Path ".tools" | Out-Null }
$url = "https://downloads.apache.org/ant/binaries/apache-ant-1.10.17-bin.zip"
$zip = ".tools\apache-ant.zip"
Write-Host "Downloading $url..."
Invoke-WebRequest -Uri $url -OutFile $zip
Write-Host "Extracting..."
Expand-Archive -Path $zip -DestinationPath ".tools" -Force
$folders = Get-ChildItem -Path ".tools" -Directory | Where-Object { $_.Name -like "apache-ant*" }
if ($folders.Count -gt 0) {
  $src = $folders[0].FullName
  $dest = ".tools\ant"
  if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
  Move-Item -Path $src -Destination $dest
  Write-Host "Ant installed to" (Resolve-Path $dest)
} else {
  Write-Host "Extraction failed or folder not found"
}
