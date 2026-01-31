package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/google/uuid"
	_ "modernc.org/sqlite"
)

var db *sql.DB

func must(err error) {
	if err != nil {
		log.Fatal(err)
	}
}

func initDB(path string) *sql.DB {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		log.Fatal(err)
	}
	db, err := sql.Open("sqlite", path)
	must(err)
	// run migrations
	migration, err := os.ReadFile("migrate.sql")
	must(err)
	_, err = db.Exec(string(migration))
	must(err)
	return db
}

func seedIfEmpty() {
	// check contacts
	var cnt int
	err := db.QueryRow(`SELECT COUNT(1) FROM contacts`).Scan(&cnt)
	if err != nil {
		// assume table missing or empty; ignore
		return
	}

	var idContact string
	if cnt == 0 {
		idContact = genID()
		_, _ = db.Exec(`INSERT INTO contacts (id,name,phone,type) VALUES (?,?,?,?)`, idContact, "Test Customer", "+1234567890", "customer")
	} else {
		// get existing contact
		_ = db.QueryRow(`SELECT id FROM contacts LIMIT 1`).Scan(&idContact)
	}

	// check inventory_items
	var itemCnt int
	_ = db.QueryRow(`SELECT COUNT(1) FROM inventory_items`).Scan(&itemCnt)

	var idItem string
	if itemCnt == 0 {
		idItem = genID()
		now := time.Now().Format(time.RFC3339)
		_, _ = db.Exec(`INSERT INTO inventory_items (id,name,sku,quantity,unit_price,reorder_level,category,description,updated_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`, idItem, "Sample Item", "SAMPLE1", 10, 9.99, 2, "General", "Seeded item", now, now)
		_, _ = db.Exec(`INSERT INTO inventory_transactions (id,item_id,quantity_change,previous_quantity,new_quantity,transaction_type,notes,created_at) VALUES (?,?,?,?,?,?,?,?)`, genID(), idItem, 10, 0, 10, "initial", "Seeded", time.Now().Format(time.RFC3339))
	} else {
		// get existing item
		_ = db.QueryRow(`SELECT id FROM inventory_items LIMIT 1`).Scan(&idItem)
		// Fix any items with blank names
		_, _ = db.Exec(`UPDATE inventory_items SET name = 'Unnamed Item' WHERE name IS NULL OR name = ''`)
		// Backfill updated_at for existing items
		_, _ = db.Exec(`UPDATE inventory_items SET updated_at = created_at WHERE updated_at IS NULL OR updated_at = ''`)
	}

	// check transactions
	var transCnt int
	_ = db.QueryRow(`SELECT COUNT(1) FROM transactions`).Scan(&transCnt)

	if transCnt == 0 {
		idTransaction := genID()
		_, _ = db.Exec(`INSERT INTO transactions (id,type,amount,paid_amount,due_amount,contact_id,created_at) VALUES (?,?,?,?,?,?,?)`, idTransaction, "inflow", 100.0, 100.0, 0.0, idContact, time.Now().Format(time.RFC3339))
		_, _ = db.Exec(`INSERT INTO transaction_items (id,transaction_id,item_id,quantity,unit_price,total_price) VALUES (?,?,?,?,?,?)`, genID(), idTransaction, idItem, 10, 9.99, 99.9)
	}
}

func genID() string {
	return uuid.New().String()
}

func main() {
	db = initDB("./data/db.sqlite")
	seedIfEmpty()
	defer db.Close()

	app := fiber.New()
	app.Use(cors.New())
	app.Use(logger.New())

	// serve uploaded files
	app.Static("/api/files", "./uploads")

	// collection style endpoints to match adapter paths
	api := app.Group("/api/collections")

	api.Get("/:collection/records", handleList)
	api.Get("/:collection/records/:id", handleGet)
	api.Post("/:collection/records", handleCreate)
	authPatch := api.Patch("/:collection/records/:id", handlePatch)
	_ = authPatch

	// file upload to record
	api.Post("/:collection/records/:id/files/:field", handleUploadFile)

	// simple listing endpoints for compatibility
	app.Get("/api/health", func(c *fiber.Ctx) error { return c.JSON(fiber.Map{"ok": true}) })

	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}
	log.Printf("Starting server on :%s\n", port)
	must(app.Listen(fmt.Sprintf(":%s", port)))
}

// ---------- Handlers ----------

func handleList(c *fiber.Ctx) error {
	collection := c.Params("collection")
	// support query params: perPage, filter (very basic), sort, expand
	queryFilter := c.Query("filter")
	expand := c.Query("expand")
	sqlQuery := ""
	switch collection {
	case "contacts":
		sqlQuery = "SELECT id,name,phone,nid,type,organization_id FROM contacts"
	case "inventory_items":
		sqlQuery = "SELECT id,COALESCE(name, 'Unnamed Item') as name,sku,quantity,unit_price,reorder_level,category,description,image_filename,image_url,updated_at,created_at FROM inventory_items"
	case "inventory_transactions":
		sqlQuery = "SELECT id,item_id,quantity_change,previous_quantity,new_quantity,transaction_type,notes,created_at FROM inventory_transactions"
	case "transactions":
		if strings.Contains(expand, "contact") {
			sqlQuery = "SELECT t.id,t.type,t.amount,t.paid_amount,t.due_amount,t.contact_id,t.image_filename,t.image_url,t.created_at, c.id as contact__id, c.name as contact__name, c.phone as contact__phone, c.nid as contact__nid, c.type as contact__type, c.organization_id as contact__organization_id FROM transactions t LEFT JOIN contacts c ON t.contact_id = c.id"
		} else {
			sqlQuery = "SELECT id,type,amount,paid_amount,due_amount,contact_id,image_filename,image_url,created_at FROM transactions"
		}
	default:
		return c.Status(404).JSON(fiber.Map{"error": "unknown collection"})
	}
	if queryFilter != "" {
		// very naive: assume simple form like field="value" or field = "value"
		// we will remove any double quotes and use LIKE
		sqlQuery = sqlQuery + " WHERE " + queryFilter
	}
	sort := c.Query("sort")
	if sort != "" {
		if strings.HasPrefix(sort, "-") {
			sort = strings.TrimPrefix(sort, "-") + " DESC"
		} else {
			sort = sort + " ASC"
		}
		sqlQuery = sqlQuery + " ORDER BY " + sort
	}
	rows, err := db.Query(sqlQuery)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()
	items := []map[string]interface{}{}
	cols, _ := rows.Columns()
	for rows.Next() {
		vals := make([]interface{}, len(cols))
		ptrs := make([]interface{}, len(cols))
		for i := range vals {
			ptrs[i] = &vals[i]
		}
		_ = rows.Scan(ptrs...)
		m := map[string]interface{}{}
		for i, col := range cols {
			v := vals[i]
			b, ok := v.([]byte)
			if ok {
				m[col] = string(b)
			} else {
				m[col] = v
			}
		}
		// handle expand
		if collection == "transactions" && strings.Contains(expand, "contact") {
			m["contact"] = map[string]interface{}{
				"id":              m["contact__id"],
				"name":            m["contact__name"],
				"phone":           m["contact__phone"],
				"nid":             m["contact__nid"],
				"type":            m["contact__type"],
				"organization_id": m["contact__organization_id"],
			}
			// remove the prefixed fields
			delete(m, "contact__id")
			delete(m, "contact__name")
			delete(m, "contact__phone")
			delete(m, "contact__nid")
			delete(m, "contact__type")
			delete(m, "contact__organization_id")
		}
		if collection == "transactions" && strings.Contains(expand, "items") {
			transactionId := m["id"]
			itemRows, err := db.Query(`SELECT ti.quantity, ti.unit_price, ti.total_price, i.id as item_id, COALESCE(i.name, 'Unnamed Item') as item_name, i.sku as item_sku FROM transaction_items ti LEFT JOIN inventory_items i ON ti.item_id = i.id WHERE ti.transaction_id = ?`, transactionId)
			if err == nil {
				var items []map[string]interface{}
				for itemRows.Next() {
					var quantity int
					var unitPrice, totalPrice float64
					var itemId, itemName, itemSku string
					_ = itemRows.Scan(&quantity, &unitPrice, &totalPrice, &itemId, &itemName, &itemSku)
					items = append(items, map[string]interface{}{
						"item_id":     itemId,
						"item_name":   itemName,
						"name":        itemName,
						"sku":         itemSku,
						"quantity":    quantity,
						"unit_price":  unitPrice,
						"total_price": totalPrice,
					})
				}
				itemRows.Close()
				m["items"] = items
			}
		}
		items = append(items, m)
	}
	return c.JSON(fiber.Map{"items": items, "page": 1, "perPage": len(items), "totalItems": len(items)})
}

func handleGet(c *fiber.Ctx) error {
	collection := c.Params("collection")
	id := c.Params("id")
	// handle GET by id for supported collections
	switch collection {
	case "contacts":
		var idVal, name, phone, nid, typ, org sql.NullString
		if err := db.QueryRow("SELECT id,name,phone,nid,type,organization_id FROM contacts WHERE id = ?", id).Scan(&idVal, &name, &phone, &nid, &typ, &org); err != nil {
			if err == sql.ErrNoRows {
				return c.Status(404).JSON(fiber.Map{"error": "not found"})
			}
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		return c.JSON(fiber.Map{"id": idVal.String, "name": name.String, "phone": phone.String, "nid": nid.String, "type": typ.String, "organization_id": org.String})
	case "inventory_items":
		var idVal, name, sku, category, description, imageFilename, imageUrl sql.NullString
		var quantity, reorderLevel sql.NullInt32
		var unitPrice sql.NullFloat64
		err := db.QueryRow(`SELECT id,name,sku,quantity,unit_price,reorder_level,category,description,image_filename,image_url FROM inventory_items WHERE id = ?`, id).Scan(&idVal, &name, &sku, &quantity, &unitPrice, &reorderLevel, &category, &description, &imageFilename, &imageUrl)
		if err != nil {
			if err == sql.ErrNoRows {
				return c.Status(404).JSON(fiber.Map{"error": "not found"})
			}
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		return c.JSON(fiber.Map{"id": idVal.String, "name": name.String, "sku": sku.String, "quantity": quantity.Int32, "unit_price": unitPrice.Float64, "reorder_level": reorderLevel.Int32, "category": category.String, "description": description.String, "image_filename": imageFilename.String, "image_url": imageUrl.String})
	case "transactions":
		var idVal, typ, contactId, imageFilename, imageUrl sql.NullString
		var amount, paidAmount, dueAmount sql.NullFloat64
		err := db.QueryRow(`SELECT id,type,amount,paid_amount,due_amount,contact_id,image_filename,image_url FROM transactions WHERE id = ?`, id).Scan(&idVal, &typ, &amount, &paidAmount, &dueAmount, &contactId, &imageFilename, &imageUrl)
		if err != nil {
			if err == sql.ErrNoRows {
				return c.Status(404).JSON(fiber.Map{"error": "not found"})
			}
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		return c.JSON(fiber.Map{"id": idVal.String, "type": typ.String, "amount": amount.Float64, "paid_amount": paidAmount.Float64, "due_amount": dueAmount.Float64, "contact_id": contactId.String, "image_filename": imageFilename.String, "image_url": imageUrl.String})
	default:
		return c.Status(501).JSON(fiber.Map{"error": "not implemented for GET record by id"})
	}
}

func handleCreate(c *fiber.Ctx) error {
	collection := c.Params("collection")
	var body map[string]interface{}
	if err := json.Unmarshal(c.Body(), &body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid json"})
	}
	id := genID()
	switch collection {
	case "contacts":
		_, err := db.Exec(`INSERT INTO contacts (id,name,phone,nid,type,organization_id) VALUES (?,?,?,?,?,?)`, id, body["name"], body["phone"], body["nid"], body["type"], body["organization_id"])
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		return c.JSON(fiber.Map{"id": id})
	case "inventory_items":
		now := time.Now().Format(time.RFC3339)
		_, err := db.Exec(`INSERT INTO inventory_items (id,name,sku,quantity,unit_price,reorder_level,category,description,updated_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`, id, body["name"], body["sku"], body["quantity"], body["unit_price"], body["reorder_level"], body["category"], body["description"], now, now)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		return c.JSON(fiber.Map{"id": id})
	case "transactions":
		_, err := db.Exec(`INSERT INTO transactions (id,type,amount,paid_amount,due_amount,contact_id,created_at) VALUES (?,?,?,?,?,?,?)`, id, body["type"], body["amount"], body["paid_amount"], body["due_amount"], body["contact_id"], time.Now().Format(time.RFC3339))
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		// handle items
		if items, ok := body["items"].([]interface{}); ok {
			for _, item := range items {
				itemMap, ok := item.(map[string]interface{})
				if !ok {
					continue
				}
				itemId, _ := itemMap["item_id"].(string)
				quantity, _ := itemMap["quantity"].(float64)
				unitPrice, _ := itemMap["unit_price"].(float64)
				totalPrice := quantity * unitPrice
				_, _ = db.Exec(`INSERT INTO transaction_items (id,transaction_id,item_id,quantity,unit_price,total_price) VALUES (?,?,?,?,?,?)`, genID(), id, itemId, int(quantity), unitPrice, totalPrice)
				// update inventory
				var currentQty int
				_ = db.QueryRow(`SELECT quantity FROM inventory_items WHERE id = ?`, itemId).Scan(&currentQty)
				var newQty int
				if body["type"] == "inflow" {
					newQty = currentQty - int(quantity)
				} else {
					newQty = currentQty + int(quantity)
				}
				_, _ = db.Exec(`UPDATE inventory_items SET quantity = ?, updated_at = ? WHERE id = ?`, newQty, time.Now().Format(time.RFC3339), itemId)
				// create inventory_transaction
				quantityChange := int(quantity)
				if body["type"] == "inflow" {
					quantityChange = -quantityChange
				}
				_, _ = db.Exec(`INSERT INTO inventory_transactions (id,item_id,quantity_change,previous_quantity,new_quantity,transaction_type,notes,created_at) VALUES (?,?,?,?,?,?,?,?)`, genID(), itemId, quantityChange, currentQty, newQty, body["type"], "From transaction", time.Now().Format(time.RFC3339))
			}
		}
		return c.JSON(fiber.Map{"id": id})
	case "inventory_transactions":
		_, err := db.Exec(`INSERT INTO inventory_transactions (id,item_id,quantity_change,previous_quantity,new_quantity,transaction_type,notes,created_at) VALUES (?,?,?,?,?,?,?,?)`, id, body["item_id"], body["quantity_change"], body["previous_quantity"], body["new_quantity"], body["transaction_type"], body["notes"], time.Now().Format(time.RFC3339))
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		return c.JSON(fiber.Map{"id": id})
	default:
		return c.Status(404).JSON(fiber.Map{"error": "unknown collection"})
	}
}

func handlePatch(c *fiber.Ctx) error {
	collection := c.Params("collection")
	id := c.Params("id")
	var body map[string]interface{}
	if err := json.Unmarshal(c.Body(), &body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid json"})
	}
	switch collection {
	case "inventory_items":
		// simple update of provided fields
		updated := false
		if name, ok := body["name"]; ok {
			_, _ = db.Exec("UPDATE inventory_items SET name = ? WHERE id = ?", name, id)
			updated = true
		}
		if q, ok := body["quantity"]; ok {
			_, _ = db.Exec("UPDATE inventory_items SET quantity = ? WHERE id = ?", q, id)
			updated = true
		}
		if updated {
			_, _ = db.Exec("UPDATE inventory_items SET updated_at = ? WHERE id = ?", time.Now().Format(time.RFC3339), id)
		}
		return c.JSON(fiber.Map{"id": id})
	case "transactions":
		// update image_url if provided
		if imageUrl, ok := body["image_url"]; ok {
			_, _ = db.Exec("UPDATE transactions SET image_url = ? WHERE id = ?", imageUrl, id)
		}
		return c.JSON(fiber.Map{"id": id})
	default:
		return c.Status(404).JSON(fiber.Map{"error": "unknown collection for patch"})
	}
}

func handleUploadFile(c *fiber.Ctx) error {
	collection := c.Params("collection")
	id := c.Params("id")
	_ = c.Params("field")
	file, err := c.FormFile("file")
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "file required"})
	}
	in, err := file.Open()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer in.Close()
	uploadsDir := filepath.Join("uploads", collection, id)
	_ = os.MkdirAll(uploadsDir, 0o755)
	outPath := filepath.Join(uploadsDir, file.Filename)
	out, err := os.Create(outPath)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer out.Close()
	_, err = io.Copy(out, in)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	url := fmt.Sprintf("/api/files/%s/%s/%s", collection, id, file.Filename)
	// update record to store file info
	if collection == "inventory_items" {
		_, _ = db.Exec("UPDATE inventory_items SET image_filename = ?, image_url = ? WHERE id = ?", file.Filename, url, id)
	} else if collection == "transactions" {
		_, _ = db.Exec("UPDATE transactions SET image_filename = ?, image_url = ? WHERE id = ?", file.Filename, url, id)
	}
	return c.JSON(fiber.Map{"filename": file.Filename, "url": url})
}
