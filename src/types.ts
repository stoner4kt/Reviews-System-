export interface Settings {
  id:                     string;
  business_name:          string;
  google_review_url:      string;
  review_from_name:       string;
  review_from_email:      string;
  review_reply_to_email:  string;
  auto_send_enabled:      boolean;
  auto_send_delay_hours:  number;
  widget_api_key:         string;
  email_subject_template: string;
  email_intro_text:       string;
  email_button_text:      string;
  email_brand_color:      string;
  created_at:             string;
  updated_at:             string;
}

export type LeadStatus =
  | 'new'
  | 'in_progress'
  | 'complete'
  | 'review_sent'
  | 'cancelled';

export type LeadSource = 'widget' | 'capture_fn' | 'manual';

export interface Lead {
  id:                string;
  first_name:        string;
  last_name:         string;
  email:             string;
  phone?:            string;
  service?:          string;
  message?:          string;
  source:            LeadSource;
  status:            LeadStatus;
  completed_at?:     string;
  review_send_after?: string;
  created_at:        string;
  updated_at:        string;
}

export interface ReviewRequest {
  id:                 string;
  lead_id:            string;
  recipient_email:    string;
  recipient_name?:    string;
  email_subject?:     string;
  resend_message_id?: string;
  status:             'sent' | 'delivered' | 'bounced' | 'failed';
  triggered_by:       'auto' | 'manual';
  sent_at:            string;
  created_at:         string;
}

export interface AppState {
  settings:       Settings | null;
  leads:          Lead[];
  reviewRequests: ReviewRequest[];
}

export interface Toast {
  id:      number;
  type:    'success' | 'error' | 'info' | 'warning';
  message: string;
  action?: { label: string; onClick: () => void };
}

export type Section = 'dashboard' | 'leads' | 'reviews' | 'email' | 'settings';