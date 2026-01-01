function Test-Port {
    param (
        [Parameter(Mandatory = $true)]
        [string]$computer,
        [Parameter(Mandatory = $true)]
        [int]$port,
        [switch]$tcp,
        [switch]$udp,
        [int]$UDPTimeOut = 700,
        [int]$TCPTimeOut = 70
    )

    if (!$tcp -and !$udp) { $tcp = $true }

    $ErrorActionPreference = "SilentlyContinue"
    $report = @()

    if ($tcp) {
        $tcpobject = New-Object System.Net.Sockets.TcpClient
        $connect = $tcpobject.BeginConnect($computer, $port, $null, $null)
        $wait = $connect.AsyncWaitHandle.WaitOne($TCPTimeOut, $false)
        if (!$wait) {
            $tcpobject.Close()
            Write-Verbose "Connection Timeout"
            $report += [pscustomobject]@{
                Server = $computer
                Port = $port
                TypePort = "TCP"
                Open = $false
                Notes = "Connection to Port Timed Out"
            }
        } else {
            $tcpobject.EndConnect($connect) | Out-Null
            $tcpobject.Close()
            $report += [pscustomobject]@{
                Server = $computer
                Port = $port
                TypePort = "TCP"
                Open = $true
                Notes = ""
            }
        }
    }

    if ($udp) {
        $udpobject = New-Object System.Net.Sockets.UdpClient
        $udpobject.Client.ReceiveTimeout = $UDPTimeOut
        $udpobject.Connect($computer, $port)
        $a = New-Object System.Text.ASCIIEncoding
        $byte = $a.GetBytes("$(Get-Date)")
        [void]$udpobject.Send($byte, $byte.Length)
        $remoteendpoint = New-Object System.Net.IPEndPoint([System.Net.IPAddress]::Any, 0)
        try {
            $receivebytes = $udpobject.Receive([ref]$remoteendpoint)
            [string]$returndata = $a.GetString($receivebytes)
            if ($returndata) {
                $report += [pscustomobject]@{
                    Server = $computer
                    Port = $port
                    TypePort = "UDP"
                    Open = $true
                    Notes = $returndata
                }
                $udpobject.Close()
            }
        } catch {
            $udpobject.Close()
            $report += [pscustomobject]@{
                Server = $computer
                Port = $port
                TypePort = "UDP"
                Open = $false
                Notes = "Connection to Port Timed Out"
            }
        }
    }

    return $report
}

# Examples
<#
.EXAMPLE
Test-Port -computer 'server' -port 80
Checks port 80 on server 'server' to see if it is listening

.EXAMPLE
'server' | Test-Port -port 80
Checks port 80 on server 'server' to see if it is listening

.EXAMPLE
Test-Port -computer @("server1","server2") -port 80
Checks port 80 on server1 and server2 to see if it is listening

.EXAMPLE
Test-Port -computer (Get-Content hosts.txt) -port 80
Checks port 80 on servers in host file to see if it is listening

.EXAMPLE
Test-Port -computer (Get-Content hosts.txt) -port @(1..59)
Checks a range of ports from 1-59 on all servers in the hosts.txt file
#>
