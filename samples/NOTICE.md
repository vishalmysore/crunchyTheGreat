# Sample attribution

## Synthetic samples

`healthcare-issue.json`, `insurance-issue.json` and `logistics-issue.json` are
fictional. The tickets, people and systems in them do not exist; they were
written for this project to exercise the pipeline.

## Real samples

`real-kafka-9366.json` and `real-spark-40588.json` are trimmed snapshots of
real, publicly readable issues from the Apache Software Foundation's Jira
(<https://issues.apache.org/jira>), retrieved via its anonymous REST API:

| File | Issue | Source |
| --- | --- | --- |
| `real-kafka-9366.json` | KAFKA-9366 | <https://issues.apache.org/jira/browse/KAFKA-9366> |
| `real-spark-40588.json` | SPARK-40588 | <https://issues.apache.org/jira/browse/SPARK-40588> |

They are included unmodified in content, trimmed only to the fields this
project's parser reads (summary, description, comments, links, metadata) so the
bundled files stay small. All issue text remains the work of its original
authors and the Apache Software Foundation, and is subject to the ASF's terms —
see <https://www.apache.org/licenses/> and
<https://www.apache.org/foundation/policies/privacy.html>.

Apache, Apache Kafka, Apache Spark and Apache Lucene are trademarks of the
Apache Software Foundation. This project is not affiliated with or endorsed by
the ASF.

To refresh a snapshot, or to try any other public issue:

```bash
curl -s "https://issues.apache.org/jira/rest/api/2/issue/KAFKA-9366" -o ticket.json
```
