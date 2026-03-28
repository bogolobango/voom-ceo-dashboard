# VOOM Ghana: WhatsApp Acquisition Bot Architecture & Feature Plan

## 1. Overview
The primary objective of this module is to accelerate customer and vendor acquisition for **voomparts.com** by discovering relevant WhatsApp groups in Ghana, joining them, and semi-automating outreach. This system will be integrated directly into the existing `voom-ceo-dashboard`, providing the CEO with a centralized command center to manage the entire acquisition pipeline. By targeting groups related to car parts, mechanics, and auto enthusiasts, VOOM can tap directly into highly engaged communities.

## 2. Core Workflows (Semi-Automated)
The acquisition process is designed as a semi-automated pipeline to ensure quality control while maximizing efficiency. The workflow begins with **Discovery**, where the CEO enters specific keywords into the dashboard. The backend then scrapes the web and social media platforms to extract public WhatsApp invite links. 

Once links are found, they enter the **Curation** phase. Discovered groups appear in a "Discovery Queue" on the dashboard, allowing the CEO to review the sources and approve or reject them. Approved groups are then queued for **Joining**, where the WhatsApp API utilizes the invite links to add the bot to the groups.

After successfully joining, the **Outreach** phase begins. The CEO can select specific groups, choose from a set of pre-approved message templates, and broadcast promotional or informational messages. Finally, the **Lead Qualification** phase handles incoming responses. When group members reply to the bot, their messages are routed to the dashboard's Lead Inbox. The CEO can then qualify these contacts as either Vendors or Customers, seamlessly adding them to the main CRM for further nurturing.

## 3. Technical Architecture

### 3.1. Group Discovery (Scraper Module)
To reliably discover WhatsApp group links without encountering rate limits or blocks from search engines and social networks, the system will utilize an API-based scraping approach. We will integrate with specialized scraping services like Apify or SerpApi. The backend will feature an Express.js route that triggers the scraper using the provided keywords, extracts URLs matching the `chat.whatsapp.com` pattern, and stores them in the database for review.

### 3.2. WhatsApp API Integration
The messaging infrastructure will be built upon the Meta WhatsApp Cloud API. Meta has recently introduced the Groups API for WhatsApp Business, which allows businesses to manage group interactions programmatically. 

It is important to note that utilizing the official Groups API requires the business to hold an Official Business Account (OBA) status. If OBA status is not immediately available, a self-hosted unofficial gateway such as WAHA (WhatsApp HTTP API) can serve as a temporary bridge. The database schema and user interface will be designed to remain API-agnostic, ensuring a smooth transition to the official API once approved. The backend will include webhook endpoints to listen for group participant updates, incoming messages, and message delivery statuses.

### 3.3. Database Schema Additions
To support the new WhatsApp acquisition features, several new tables will be added to the Drizzle ORM schema.

| Table Name | Purpose | Key Columns |
| :--- | :--- | :--- |
| `whatsapp_groups` | Stores discovered and joined WhatsApp groups. | `id`, `name`, `inviteLink`, `source`, `status`, `memberCount` |
| `whatsapp_leads` | Tracks individuals who interact with the bot. | `id`, `phone`, `name`, `type`, `status`, `sourceGroupId` |
| `whatsapp_messages` | Logs all inbound and outbound messages for leads. | `id`, `leadId`, `groupId`, `direction`, `content`, `sentAt` |

### 3.4. Dashboard UI Integration
A new primary section titled **WhatsApp Acquisition** will be added to the dashboard's sidebar. This section will be divided into three distinct sub-interfaces to manage the workflow.

| Interface | Description | Features |
| :--- | :--- | :--- |
| **Discovery Radar** | The interface for finding and curating new groups. | Keyword search bar, data table of discovered links, Approve/Reject actions. |
| **Group Manager** | The control center for managing joined groups and broadcasting. | List of active groups, audience metrics, template selection, broadcast execution. |
| **Lead Inbox** | A unified inbox for handling replies and qualifying leads. | Chat interface, quick-action buttons to tag contacts as Vendors or Customers. |

## 4. Implementation Phases
The implementation of this scaffold will be executed in four distinct phases. First, the database schema will be updated with the new tables, and the changes will be pushed using Drizzle. Second, the backend API will be expanded to include integration routes for the scraper, CRUD operations for groups and leads, and the foundational webhook structure for WhatsApp events. 

Third, the frontend user interface will be developed. This involves adding the new sidebar section and building the Discovery Radar, Group Manager, and Lead Inbox components using the existing Arctic Glass design system. Finally, comprehensive documentation will be provided, detailing the steps required to set up a Meta Developer Account, apply for Official Business Account status, and configure the necessary webhooks for production deployment.
