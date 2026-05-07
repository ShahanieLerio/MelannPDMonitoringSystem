Add-Type -AssemblyName System.Drawing

$pngPath = "C:\Users\Admin\OneDrive\Documents\Project System\MelannPastDueReportMonitoring\assets\Icon desktop logo.png"
$icoPath = "C:\Users\Admin\OneDrive\Documents\Project System\MelannPastDueReportMonitoring\assets\MelannSystem.ico"
$batDesktop = "C:\Users\Admin\OneDrive\Desktop\Start_Melann_System.bat"
$batProject = "C:\Users\Admin\OneDrive\Documents\Project System\MelannPastDueReportMonitoring\Start_Melann_System.bat"
$shortcutPath = "C:\Users\Admin\OneDrive\Desktop\Melann Lending System.lnk"

try {
    # 1. Move batch file from Desktop to project root so we don't have two icons
    if (Test-Path $batDesktop) {
        Move-Item -Path $batDesktop -Destination $batProject -Force
    }

    # 2. Convert PNG to ICO
    $bitmap = [System.Drawing.Bitmap]::FromFile($pngPath)
    
    # Create a properly sized 256x256 bitmap for the icon
    $newBitmap = New-Object System.Drawing.Bitmap(256, 256)
    $g = [System.Drawing.Graphics]::FromImage($newBitmap)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($bitmap, 0, 0, 256, 256)
    
    $iconHandle = $newBitmap.GetHicon()
    $icon = [System.Drawing.Icon]::FromHandle($iconHandle)
    $iconStream = [System.IO.File]::Create($icoPath)
    $icon.Save($iconStream)
    
    $iconStream.Close()
    $iconStream.Dispose()
    $g.Dispose()
    $newBitmap.Dispose()
    $bitmap.Dispose()

    # 3. Create actual shortcut (.lnk) on Desktop
    $WshShell = New-Object -ComObject WScript.Shell
    $shortcut = $WshShell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = $batProject
    $shortcut.WorkingDirectory = "C:\Users\Admin\OneDrive\Documents\Project System\MelannPastDueReportMonitoring"
    $shortcut.IconLocation = "$icoPath,0"
    $shortcut.Save()

    Write-Host "Success"
} catch {
    Write-Error $_
}
