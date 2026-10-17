package errs

import (
	"errors"
	"strings"

	"modernc.org/sqlite"
	sqlite3 "modernc.org/sqlite/lib"
)

// DomainErrorFromUniqueViolation maps known unique constraints to client-facing errors.
func DomainErrorFromUniqueViolation(err error) *DomainError {
	var sqliteErr *sqlite.Error
	if !errors.As(err, &sqliteErr) || sqliteErr.Code() != sqlite3.SQLITE_CONSTRAINT_UNIQUE {
		return nil
	}
	if isUsersEmailUniqueConstraint(sqliteErr.Error()) {
		return NewBadRequestError(ErrKeyAuthUserExists, "User with this email already exists")
	}
	return nil
}

// SQLite names the column ("users.email") or, for an expression index, the index.
func isUsersEmailUniqueConstraint(message string) bool {
	return strings.Contains(message, "users.email") || strings.Contains(message, "idx_users_email_lower")
}
