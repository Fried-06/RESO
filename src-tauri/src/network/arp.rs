use crate::models::{ArpResult, PingResult};
use std::net::Ipv4Addr;


#[cfg(windows)]
mod win_arp {
    use super::*;

    #[link(name = "iphlpapi")]
    extern "system" {
        fn SendARP(
            dest_ip: u32,
            src_ip: u32,
            mac_addr: *mut u8,
            phys_addr_len: *mut u32,
        ) -> u32;
    }

    /// Resolves MAC address via native Windows SendARP Win32 API.
    pub fn resolve_arp(ip: Ipv4Addr) -> ArpResult {
        let ip_str = ip.to_string();
        let dest_ip_u32 = u32::from_ne_bytes(ip.octets());
        let mut mac_bytes = [0u8; 6];
        let mut mac_len = 6u32;

        let ret = unsafe {
            SendARP(
                dest_ip_u32,
                0,
                mac_bytes.as_mut_ptr(),
                &mut mac_len as *mut u32,
            )
        };

        if ret == 0 && mac_len == 6 {
            let mac_str = format!(
                "{:02X}:{:02X}:{:02X}:{:02X}:{:02X}:{:02X}",
                mac_bytes[0], mac_bytes[1], mac_bytes[2], mac_bytes[3], mac_bytes[4], mac_bytes[5]
            );
            ArpResult {
                ip: ip_str,
                resolved: true,
                mac_address: Some(mac_str),
                error: None,
            }
        } else {
            ArpResult {
                ip: ip_str,
                resolved: false,
                mac_address: None,
                error: Some(format!("SendARP return code: {}", ret)),
            }
        }
    }
}

/// Asynchronously attempts to resolve ARP for an IPv4 address.
pub async fn resolve_arp_async(target_ip: &str) -> ArpResult {
    let parsed_ip = match target_ip.parse::<Ipv4Addr>() {
        Ok(ip) => ip,
        Err(_) => {
            return ArpResult {
                ip: target_ip.to_string(),
                resolved: false,
                mac_address: None,
                error: Some("Target is not a valid IPv4 address for ARP query".to_string()),
            };
        }
    };

    #[cfg(windows)]
    {
        tokio::task::spawn_blocking(move || win_arp::resolve_arp(parsed_ip))
            .await
            .unwrap_or_else(|e| ArpResult {
                ip: target_ip.to_string(),
                resolved: false,
                mac_address: None,
                error: Some(format!("Worker thread panicked: {}", e)),
            })
    }

    #[cfg(not(windows))]
    {
        // On Unix/macOS, query local arp cache
        let output = tokio::process::Command::new("arp")
            .arg("-n")
            .arg(parsed_ip.to_string())
            .output()
            .await;

        match output {
            Ok(out) if out.status.success() => {
                let stdout = String::from_utf8_lossy(&out.stdout);
                let resolved = stdout.contains(":") || stdout.contains("-");
                ArpResult {
                    ip: target_ip.to_string(),
                    resolved,
                    mac_address: None,
                    error: None,
                }
            }
            _ => ArpResult {
                ip: target_ip.to_string(),
                resolved: false,
                mac_address: None,
                error: Some("ARP table lookup failed".to_string()),
            },
        }
    }
}

/// Evaluates L3 Ping and ARP results to produce a factual, nuanced explanation.
pub fn explain_l3_connectivity(ping: &PingResult, arp: Option<&ArpResult>) -> (String, String) {
    if ping.success {
        let lat = ping.latency_ms.map(|l| format!("{:.1} ms", l)).unwrap_or_else(|| "N/A".to_string());
        (
            "reachable".to_string(),
            format!("Équipement joignable (ICMP Echo reçu, latence : {})", lat),
        )
    } else {
        match arp {
            Some(arp_res) if arp_res.resolved => {
                let mac = arp_res.mac_address.as_deref().unwrap_or("résolu");
                (
                    "arp_active_icmp_filtered".to_string(),
                    format!(
                        "Équipement détecté au niveau liaison L2 (ARP MAC : {}), mais les requêtes ICMP/Ping semblent filtrées par un pare-feu",
                        mac
                    ),
                )
            }
            Some(_) => (
                "unreachable".to_string(),
                "Aucun équipement n'a pu être confirmé à cette adresse depuis le poste de supervision (échec Ping et non-résolution ARP)".to_string(),
            ),
            None => (
                "unreachable".to_string(),
                format!(
                    "Échec du Ping ICMP ({})",
                    ping.error.as_deref().unwrap_or("Délai d'attente dépassé")
                ),
            ),
        }
    }
}
