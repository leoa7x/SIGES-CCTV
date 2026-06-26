package client

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type Device struct {
	ID            string `json:"id"`
	Type          string `json:"type"`     // "node" | "camera"
	IP            string `json:"ip"`
	MAC           string `json:"mac"`
	NodeType      string `json:"nodeType"` // "SWITCH" | "" etc.
	SNMPCommunity string `json:"snmpCommunity"`
	State         string `json:"state"`
	CenterID      string `json:"centerId"`
}

type Client struct {
	baseURL string
	token   string
	http    *http.Client
}

func NewClient(apiURL, token string) *Client {
	return &Client{
		baseURL: apiURL,
		token:   token,
		http:    &http.Client{Timeout: 10 * time.Second},
	}
}

func (c *Client) GetDevices() ([]Device, error) {
	req, err := http.NewRequest(http.MethodGet, c.baseURL+"/internal/devices", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+c.token)

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("GET /internal/devices: %d %s", resp.StatusCode, body)
	}

	var devices []Device
	if err := json.NewDecoder(resp.Body).Decode(&devices); err != nil {
		return nil, err
	}
	return devices, nil
}

func (c *Client) PostStateChange(entityType, entityID, oldState, newState string) error {
	payload := map[string]string{
		"entityType": entityType,
		"entityId":   entityID,
		"oldState":   oldState,
		"newState":   newState,
	}
	body, _ := json.Marshal(payload)

	req, err := http.NewRequest(http.MethodPost, c.baseURL+"/internal/state-change", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+c.token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("POST /internal/state-change: %d %s", resp.StatusCode, b)
	}
	return nil
}
