import os
import requests
import feedparser
from flask import Flask, render_template, jsonify, request
from datetime import datetime
import re

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

def parse_release_notes():
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    try:
        response = requests.get(FEED_URL, headers=headers, timeout=15)
        response.raise_for_status()
        feed_data = response.text
    except Exception as e:
        print(f"Error fetching feed: {e}")
        # Return empty list or fallback error structure
        return [], str(e)
        
    parsed = feedparser.parse(feed_data)
    entries = []
    
    for idx, entry in enumerate(parsed.entries):
        # Extract title
        title = entry.get("title", "No Title")
        
        # Extract link
        link = entry.get("link", "https://cloud.google.com/bigquery/docs/release-notes")
        
        # Extract published / updated date
        raw_date = entry.get("published") or entry.get("updated") or ""
        formatted_date = raw_date
        parsed_dt = None
        
        if hasattr(entry, "published_parsed") and entry.published_parsed:
            try:
                parsed_dt = datetime(*entry.published_parsed[:6])
                formatted_date = parsed_dt.strftime("%B %d, %Y")
            except Exception:
                pass
        elif hasattr(entry, "updated_parsed") and entry.updated_parsed:
            try:
                parsed_dt = datetime(*entry.updated_parsed[:6])
                formatted_date = parsed_dt.strftime("%B %d, %Y")
            except Exception:
                pass

        # Extract content / summary
        content = ""
        if "content" in entry and len(entry["content"]) > 0:
            content = entry["content"][0].get("value", "")
        elif "summary" in entry:
            content = entry.get("summary", "")
            
        # Determine tag / type based on title or content keywords
        tag = "UPDATE"
        content_upper = (title + " " + content).upper()
        if "FEATURE" in content_upper or "INTRODUCE" in content_upper or "ANNOUNCING" in content_upper or "NEW" in content_upper:
            tag = "FEATURE"
        elif "FIX" in content_upper or "RESOLVE" in content_upper:
            tag = "FIX"
        elif "DEPRECATE" in content_upper or "REMOVE" in content_upper:
            tag = "DEPRECATION"
        elif "CHANGE" in content_upper or "UPDATE" in content_upper:
            tag = "CHANGED"

        # Plain text summary for tweet creation
        clean_text = re.sub(r'<[^>]+>', ' ', content)
        clean_text = ' '.join(clean_text.split())
        if len(clean_text) > 200:
            short_summary = clean_text[:197] + "..."
        else:
            short_summary = clean_text

        entries.append({
            "id": entry.get("id", f"entry-{idx}"),
            "title": title,
            "link": link,
            "raw_date": raw_date,
            "formatted_date": formatted_date,
            "content": content,
            "short_summary": short_summary,
            "tag": tag
        })
        
    return entries, None

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/release-notes")
def get_release_notes():
    notes, error = parse_release_notes()
    if error and not notes:
        return jsonify({"success": False, "error": error, "notes": []}), 500
    return jsonify({
        "success": True, 
        "count": len(notes),
        "fetched_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "notes": notes
    })

if __name__ == "__main__":
    app.run(debug=True, host="127.0.0.1", port=5000)
